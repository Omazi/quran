import {
  chromeAppearanceOf,
  hourOfDay,
  mixHex,
  relativeLuminance,
  skyPhaseAt,
  skyStateAt,
} from '../sky-state';

describe('the sky follows the hour (maquette-wow, js/sky.js)', () => {
  it('is exactly the light of the garden pictures at 12:30, the keyframe of noon', () => {
    const noon = skyStateAt(12.5);
    expect(noon.sunColor).toBe('#fff3df');
    expect(noon.sunIntensity).toBeCloseTo(1.75);
    expect(noon.hemiSky).toBe('#ffffff');
    expect(noon.hemiGround).toBe('#cfc3b0');
    expect(noon.hemiIntensity).toBeCloseTo(1.9);
    expect(noon.night).toBe(0);
    expect(noon.stars).toBe(0);
  });

  it('is the same sky at midnight and at 24:00, and wraps hours outside the day', () => {
    expect(skyStateAt(0).top).toBe(skyStateAt(24).top);
    expect(skyStateAt(25).top).toBe(skyStateAt(1).top);
    expect(skyStateAt(-1).top).toBe(skyStateAt(23).top);
  });

  it('interpolates between keyframes along a smooth step: halfway in time is halfway in colour', () => {
    // 8:00 and 12:30 are keyframes; 10:15 is halfway, where the smooth step is exactly 1/2.
    expect(skyStateAt(10.25).top).toBe(mixHex('#7DB0D8', '#6CAADB', 0.5));
  });

  it('never jumps: a minute later the sky has barely changed, all day long', () => {
    let previous = skyStateAt(0);
    for (let minute = 1; minute <= 24 * 60; minute += 1) {
      const next = skyStateAt(minute / 60);
      // The fastest change is the dawn, from 5:42 to 6:30: about 1 % of luminance a minute.
      expect(Math.abs(relativeLuminance(next.top) - relativeLuminance(previous.top))).toBeLessThan(
        0.015,
      );
      expect(Math.abs(next.night - previous.night)).toBeLessThan(0.02);
      previous = next;
    }
  });

  it('names the phases: dawn, day, sunset, night', () => {
    expect(skyPhaseAt(3)).toBe('night');
    expect(skyPhaseAt(6.5)).toBe('dawn');
    expect(skyPhaseAt(13)).toBe('day');
    expect(skyPhaseAt(18.4)).toBe('sunset');
    expect(skyPhaseAt(22.5)).toBe('night');
    expect(skyStateAt(18.4).phase).toBe('sunset');
  });

  it('shows stars, the moon and no sun at night; the sun and no stars by day', () => {
    const night = skyStateAt(22.5);
    expect(night.stars).toBeGreaterThan(0.9);
    expect(night.moon.on).toBeGreaterThan(0.5);
    expect(night.sun.on).toBe(0);
    const day = skyStateAt(13);
    expect(day.stars).toBe(0);
    expect(day.sun.on).toBeGreaterThan(0.5);
    expect(day.moon.on).toBe(0);
  });

  it('moves the sun from the left in the morning to the right in the evening', () => {
    expect(skyStateAt(8).sun.x).toBeLessThan(0.5);
    expect(skyStateAt(16).sun.x).toBeGreaterThan(0.5);
  });

  it('lights the garden from above, from where the sun or the moon is', () => {
    for (const hour of [0, 6.5, 12.5, 18.4, 22]) {
      const [, y] = skyStateAt(hour).sunDirection;
      expect(y).toBeGreaterThan(0);
    }
    // The morning sun on one side of the garden, the evening sun on the other.
    expect(skyStateAt(8).sunDirection[0]).not.toBeCloseTo(skyStateAt(16).sunDirection[0], 0);
  });

  it('counts as night for the glass when the top of the sky is dark, as the mockup shots show', () => {
    expect(skyStateAt(13).theme).toBe('day'); // 01-accueil-jour
    expect(skyStateAt(6.5).theme).toBe('day'); // 04-accueil-aube
    expect(skyStateAt(18.4).theme).toBe('night'); // 02-accueil-coucher: dark glass
    expect(skyStateAt(22.5).theme).toBe('night'); // 03-accueil-nuit
  });

  it('tints the water with the sky', () => {
    expect(skyStateAt(13).water).not.toBe(skyStateAt(22.5).water);
  });

  it('refuses an hour that is not a number', () => {
    expect(() => skyStateAt(Number.NaN)).toThrow(RangeError);
    expect(() => skyPhaseAt(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});

describe('the appearance of what floats on the sky', () => {
  it('takes the night values over a night sky, whatever the device appearance', () => {
    expect(chromeAppearanceOf('night', 'light')).toBe('dark');
    expect(chromeAppearanceOf('night', 'dark')).toBe('dark');
  });

  it('keeps the dusk palette in Dark Mode, even under a day sky', () => {
    expect(chromeAppearanceOf('day', 'dark')).toBe('dark');
    expect(chromeAppearanceOf('day', 'light')).toBe('light');
  });
});

describe('the hour of a date', () => {
  it('is the local hour with its minutes as a fraction', () => {
    expect(hourOfDay(new Date(2026, 10, 27, 18, 24))).toBeCloseTo(18.4);
    expect(hourOfDay(new Date(2026, 10, 27, 0, 0))).toBe(0);
  });
});

describe('colour helpers', () => {
  it('mixes two colours', () => {
    expect(mixHex('#000000', '#ffffff', 0)).toBe('#000000');
    expect(mixHex('#000000', '#ffffff', 1)).toBe('#ffffff');
    expect(mixHex('#000000', '#ffffff', 0.5)).toBe('#808080');
  });

  it('measures luminance as WCAG does', () => {
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1);
    expect(relativeLuminance('#000000')).toBe(0);
  });

  it('refuses a colour that is not #rrggbb', () => {
    expect(() => mixHex('red', '#ffffff', 0.5)).toThrow(TypeError);
  });
});
