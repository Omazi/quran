/**
 * The polish audit, run inside a page (a mockup or the app's web render). It measures instead of
 * looking: where the ink of each short text really is inside the pill, button or frame that holds
 * it, whether a label is cut, whether an icon and its text share a middle, whether two texts of a
 * row share a baseline, how big a touch target is. `audit.py` injects it and reads `designAudit()`.
 *
 * How the ink is found without a picture: the browser shapes the same string in the same font on
 * a canvas (`measureText`), which gives the real top and bottom of the glyphs around the
 * baseline; the baseline itself is read from the page with a zero-size probe. `audit.py` then
 * checks every finding again on the pixels (ink.py), so a wrong guess here cannot pass.
 */
(() => {
  const ARABIC = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/;
  /** Letters without a mark: the band of an Arabic line, from the top of alif-lam to the bowls. */
  const ARABIC_BAND = 'سورة ال';
  const canvas = document.createElement('canvas');
  const pen = canvas.getContext('2d');

  const round = (value) => Math.round(value * 100) / 100;
  const visible = (element) => {
    if (typeof element.checkVisibility === 'function') {
      return element.checkVisibility({ opacityProperty: true, visibilityProperty: true });
    }
    const style = getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
  };
  const opacityOf = (element) => {
    let opacity = 1;
    for (let node = element; node && node !== document.documentElement; node = node.parentElement) {
      opacity *= Number(getComputedStyle(node).opacity);
    }
    return opacity;
  };
  const alpha = (colour) => {
    const parts = colour.match(/[\d.]+/g);
    if (!parts) return 0;
    if (colour.startsWith('color(')) return parts.length > 3 ? Number(parts[3]) : 1;
    return parts.length > 3 ? Number(parts[3]) : 1;
  };

  /** Does this element draw a box of its own: a fill, a rule, a shadow, a glass? */
  function drawsBox(element) {
    const style = getComputedStyle(element);
    if (alpha(style.backgroundColor) > 0.03) return true;
    if (style.backgroundImage !== 'none') return true;
    if (style.boxShadow !== 'none') return true;
    if ((style.backdropFilter || style.webkitBackdropFilter || 'none') !== 'none') return true;
    for (const side of ['Top', 'Bottom', 'Left', 'Right']) {
      if (
        parseFloat(style[`border${side}Width`]) > 0 &&
        alpha(style[`border${side}Color`]) > 0.03
      ) {
        return true;
      }
    }
    return false;
  }

  /** A frame drawn by a sibling that fills the parent (an SVG rule, an absolute border view). */
  function hasDrawnFrame(element) {
    const box = element.getBoundingClientRect();
    return [...element.children].some((child) => {
      const style = getComputedStyle(child);
      if (style.position !== 'absolute') return false;
      const rect = child.getBoundingClientRect();
      const fills = rect.width >= box.width * 0.9 && rect.height >= box.height * 0.6;
      return fills && (child.tagName.toLowerCase() === 'svg' || drawsBox(child));
    });
  }

  function containerOf(element, limit) {
    for (let node = element; node && node !== document.body; node = node.parentElement) {
      const rect = node.getBoundingClientRect();
      if (rect.height > limit) return null;
      if (drawsBox(node) || hasDrawnFrame(node)) return node;
    }
    return null;
  }

  /** The canvas answers in whole pixels: the text is measured eight times larger, then divided. */
  const ZOOM = 8;

  function measure(text, style) {
    const size = parseFloat(style.fontSize);
    const spacing = style.letterSpacing === 'normal' ? 0 : parseFloat(style.letterSpacing);
    pen.font = `${style.fontStyle} ${style.fontWeight} ${size * ZOOM}px ${style.fontFamily}`;
    pen.direction = style.direction;
    pen.textAlign = 'left';
    pen.textBaseline = 'alphabetic';
    pen.letterSpacing = `${spacing * ZOOM}px`;
    pen.fontKerning = 'normal';
    const large = pen.measureText(text);
    return {
      actualBoundingBoxAscent: large.actualBoundingBoxAscent / ZOOM,
      actualBoundingBoxDescent: large.actualBoundingBoxDescent / ZOOM,
      actualBoundingBoxLeft: large.actualBoundingBoxLeft / ZOOM,
      actualBoundingBoxRight: large.actualBoundingBoxRight / ZOOM,
    };
  }

  /**
   * The y of the baseline of a line of text. The box of a run of glyphs (what a range reports)
   * starts one font ascent above the baseline, and the canvas knows that ascent as the layout
   * rounds it. Nothing is added to the page: a probe would become a flex item and move the text.
   */
  function baselineOf(line, style) {
    pen.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    return line.top + pen.measureText('x').fontBoundingBoxAscent;
  }

  /** The column an icon and its label, or two lines of text, are stacked in, below `container`. */
  function columnOf(element, container) {
    let found = null;
    for (
      let node = element.parentElement;
      node && node !== container.parentElement;
      node = node.parentElement
    ) {
      const style = getComputedStyle(node);
      const shown = [...node.children].filter(
        (child) => visible(child) && getComputedStyle(child).position !== 'absolute',
      );
      const stacked =
        shown.length > 1 &&
        ((style.display.includes('flex') && style.flexDirection.startsWith('column')) ||
          (!style.display.includes('flex') &&
            !style.display.includes('grid') &&
            shown.every((child) => getComputedStyle(child).display === 'block')));
      if (stacked) found = node;
    }
    return found;
  }

  /** The band the eye centres: capitals for Latin, alif-lam to the bowls for Arabic. */
  function bandOf(text, style) {
    if (ARABIC.test(text)) {
      const band = measure(ARABIC_BAND, style);
      return {
        up: band.actualBoundingBoxAscent,
        down: band.actualBoundingBoxDescent,
        of: 'arabic',
      };
    }
    if (/[A-Z0-9À-Þ]/.test(text)) {
      return { up: measure('H', style).actualBoundingBoxAscent, down: 0, of: 'capitals' };
    }
    if (/[a-zß-ÿ]/.test(text)) {
      const tall = /[bdfhklt]/.test(text) ? 'h' : 'x';
      return { up: measure(tall, style).actualBoundingBoxAscent, down: 0, of: tall };
    }
    const own = measure(text, style);
    return { up: own.actualBoundingBoxAscent, down: own.actualBoundingBoxDescent, of: 'ink' };
  }

  const describe = (element) => {
    const id = element.id ? `#${element.id}` : '';
    const test = element.getAttribute('data-testid');
    const name = typeof element.className === 'string' ? element.className : '';
    const classes = name
      .split(/\s+/)
      .filter((part) => part && !/^(css|r)-/.test(part))
      .slice(0, 3)
      .map((part) => `.${part}`)
      .join('');
    return `${element.tagName.toLowerCase()}${id}${classes}${test ? `[${test}]` : ''}`;
  };

  function textLeaves(root) {
    const leaves = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const seen = new Set();
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const parent = node.parentElement;
      if (!node.nodeValue.trim() || !parent || seen.has(parent)) continue;
      if (['SCRIPT', 'STYLE', 'TITLE', 'NOSCRIPT'].includes(parent.tagName)) continue;
      seen.add(parent);
      leaves.push(parent);
    }
    return leaves;
  }

  window.designAudit = (options = {}) => {
    const root = options.root ? document.querySelector(options.root) : document.body;
    const frame = (options.frame ? document.querySelector(options.frame) : null) || root;
    const screen = frame.getBoundingClientRect();
    const limit = options.containerLimit || 132;
    const onScreen = (rect) =>
      rect.width > 0 &&
      rect.height > 0 &&
      rect.right > screen.left + 1 &&
      rect.left < screen.right - 1 &&
      rect.bottom > screen.top + 1 &&
      rect.top < screen.bottom - 1;

    const texts = [];
    const kept = [];
    window.designAuditInk = (index, shown) => {
      // Shows or hides the glyphs of one audited text, and nothing else: audit.py compares the two
      // pictures to find its real ink.
      const style = kept[index].style;
      if (shown) {
        style.removeProperty('-webkit-text-fill-color');
        style.removeProperty('text-shadow');
      } else {
        style.setProperty('-webkit-text-fill-color', 'transparent', 'important');
        style.setProperty('text-shadow', 'none', 'important');
      }
    };
    for (const element of textLeaves(root)) {
      if (!visible(element) || opacityOf(element) < 0.2) continue;
      const style = getComputedStyle(element);
      const own = [...element.childNodes]
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => node.nodeValue)
        .join('')
        .replace(/\s+/g, ' ')
        .trim();
      const text = (element.children.length === 0 ? element.textContent : own)
        .replace(/\s+/g, ' ')
        .trim();
      if (!text) continue;
      const range = document.createRange();
      range.selectNodeContents(element);
      const lines = [...range.getClientRects()].filter((rect) => rect.width > 0.5);
      if (lines.length === 0) continue;
      const rect = range.getBoundingClientRect();
      if (!onScreen(rect)) continue;
      const tops = new Set(lines.map((line) => Math.round(line.top)));
      const single = tops.size === 1 && element.children.length === 0;
      const entry = {
        index: kept.push(element) - 1,
        text: text.slice(0, 48),
        element: describe(element),
        font: `${style.fontWeight} ${parseFloat(style.fontSize)}px ${style.fontFamily.split(',')[0].replace(/"/g, '')}`,
        colour: style.color,
        opacity: round(opacityOf(element)),
        box: [round(rect.left), round(rect.top), round(rect.right), round(rect.bottom)],
        single,
        arabic: ARABIC.test(text),
        // A glyph of an icon font (private use area): an icon, measured by its ink.
        glyphIcon: /^[\uE000-\uF8FF\u{F0000}-\u{FFFFD}]+$/u.test(text),
      };
      // A cut label: more content than room, with the overflow hidden.
      const clips = style.overflow !== 'visible' || style.textOverflow === 'ellipsis';
      if (clips && element.scrollWidth > element.clientWidth + 1) {
        entry.truncated = { needs: element.scrollWidth, has: element.clientWidth };
      }
      if (clips && single && element.scrollHeight > element.clientHeight + 1) {
        entry.clippedHeight = { needs: element.scrollHeight, has: element.clientHeight };
      }
      if (single) {
        const metrics = measure(text, style);
        const baseline = baselineOf(lines[0], style);
        const band = bandOf(text, style);
        const left = lines[0].left;
        entry.baseline = round(baseline);
        entry.ink = [
          round(left - metrics.actualBoundingBoxLeft),
          round(baseline - metrics.actualBoundingBoxAscent),
          round(left + metrics.actualBoundingBoxRight),
          round(baseline + metrics.actualBoundingBoxDescent),
        ];
        entry.band = [round(baseline - band.up), round(baseline + band.down), band.of];
        const container = containerOf(element, limit);
        if (container) {
          const box = container.getBoundingClientRect();
          const sole =
            textLeaves(container).filter((leaf) => visible(leaf)).length === 1 &&
            container.querySelectorAll('svg, img, canvas').length ===
              container.querySelectorAll(':scope > svg[style*="absolute"], :scope > svg.frame')
                .length;
          const column = columnOf(element, container);
          if (column) {
            const stack = column.getBoundingClientRect();
            entry.column = [
              round(stack.left),
              round(stack.top),
              round(stack.right),
              round(stack.bottom),
            ];
            // Only texts and pictures in it: its ink can be measured. A bar, a switch or a field
            // among them has a box of its own that this audit does not read.
            entry.columnOfInk = [...column.children].every(
              (child) =>
                !visible(child) ||
                getComputedStyle(child).position === 'absolute' ||
                ['svg', 'img'].includes(child.tagName.toLowerCase()) ||
                (child.querySelector('*:not(svg):not(svg *):not(img)') === null &&
                  child.textContent.trim() !== '') ||
                (child.children.length === 1 &&
                  ['svg', 'img'].includes(child.children[0].tagName.toLowerCase())),
            );
          }
          entry.container = {
            element: describe(container),
            pressable: container.matches(
              'button, a, [role="button"], [role="radio"], [role="tab"]',
            ),
            box: [round(box.left), round(box.top), round(box.right), round(box.bottom)],
            sole,
            // > 0: the band of the text is low in its container, in CSS pixels.
            bandOffset: round((entry.band[0] + entry.band[1]) / 2 - (box.top + box.bottom) / 2),
            inkOffset: round((entry.ink[1] + entry.ink[3]) / 2 - (box.top + box.bottom) / 2),
            inkMargins: {
              top: round(entry.ink[1] - box.top),
              bottom: round(box.bottom - entry.ink[3]),
              left: round(entry.ink[0] - box.left),
              right: round(box.right - entry.ink[2]),
            },
          };
        }
      }
      texts.push(entry);
    }

    // Icons: every small picture, with the row it sits in when it has one (is its middle the
    // middle of the text beside it?).
    const icons = [];
    for (const icon of root.querySelectorAll('svg, img')) {
      if (!visible(icon) || opacityOf(icon) < 0.2) continue;
      const rect = icon.getBoundingClientRect();
      if (!onScreen(rect) || rect.height > 48 || rect.height < 6) continue;
      const row = icon.parentElement;
      const style = row ? getComputedStyle(row) : null;
      const inRow =
        style && style.display.includes('flex') && style.flexDirection.startsWith('row');
      const rowRect = inRow ? row.getBoundingClientRect() : null;
      icons.push({
        element: describe(icon),
        row: inRow ? describe(row) : null,
        box: [round(rect.left), round(rect.top), round(rect.right), round(rect.bottom)],
        rowBox: rowRect
          ? [round(rowRect.left), round(rowRect.top), round(rowRect.right), round(rowRect.bottom)]
          : null,
      });
    }

    // Touch targets.
    const targets = [];
    const pressable =
      'button, a[href], [role="button"], [role="tab"], [role="switch"], [role="link"], [role="radio"], input, [tabindex="0"]';
    for (const element of root.querySelectorAll(pressable)) {
      if (!visible(element) || opacityOf(element) < 0.2) continue;
      const rect = element.getBoundingClientRect();
      if (!onScreen(rect)) continue;
      targets.push({
        element: describe(element),
        label: (element.getAttribute('aria-label') || element.textContent || '')
          .trim()
          .slice(0, 40),
        box: [round(rect.left), round(rect.top), round(rect.right), round(rect.bottom)],
        width: round(rect.width),
        height: round(rect.height),
      });
    }

    return {
      screen: [round(screen.left), round(screen.top), round(screen.right), round(screen.bottom)],
      direction: getComputedStyle(root).direction,
      texts,
      icons,
      targets,
    };
  };
})();
