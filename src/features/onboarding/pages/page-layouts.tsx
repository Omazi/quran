import { useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { AppText, layout, spacing, useColors } from '@/ui';

/** The smallest height of a scene: below it an image would no longer read. */
const SCENE_MIN_HEIGHT = spacing.xxl * 4;

/**
 * The share of the page height the scene takes. A share of the page, not of what the words leave,
 * so that the scene and the first word of every page sit at the same height as the pages slide
 * past one another. 0.6 of the page is about 57 % of the screen: the garden fills the top of the
 * screen and the words sit just under it, as in the validated mockup (docs/design/bienvenue.png).
 */
const SCENE_PAGE_SHARE = 0.6;

/** The smallest height left to a list of settings: about three rows at the default text size. */
const LIST_MIN_HEIGHT = layout.touchTarget * 3;

interface PageTextProps {
  title: string;
  text: string;
}

/**
 * The words of a page: its title, in the page-title style of the charter, and one sentence. The
 * sentence is the content of the page, so it takes the primary label colour like the title
 * (accessibility.md › Vision); size and weight tell them apart. Both follow the writing direction
 * (right-to-left.md › Text alignment).
 */
function PageText({ title, text }: PageTextProps) {
  return (
    <View style={styles.text}>
      <AppText variant="title2">{title}</AppText>
      <AppText>{text}</AppText>
    </View>
  );
}

export interface ScenePageLayoutProps extends PageTextProps {
  /** Drawn in the space above the words. */
  scene: ReactNode;
}

/**
 * A page that shows a scene, then its title and sentence. The page has the whole height of the
 * pager: the scene takes the top of it, from the top edge to the side edges, and the words sit in
 * the lower part of the page, under it, the way the validated mockup has them
 * (layout.md › Visual hierarchy: the most important first, then the words that explain it). At
 * the largest text sizes the scene keeps a minimum height and the page scrolls, so that no word
 * is cut (layout.md › Adaptability). The page paints its own background, the system's, so that
 * nothing changes colour while a neighbouring page slides in.
 */
export function ScenePageLayout({ scene, title, text }: ScenePageLayoutProps) {
  const colors = useColors();
  const [pageHeight, setPageHeight] = useState<number | null>(null);
  const onLayout = (event: LayoutChangeEvent) => setPageHeight(event.nativeEvent.layout.height);
  // Until the page is measured the scene takes what the words leave.
  const sceneSize =
    pageHeight === null
      ? styles.sceneUnmeasured
      : { height: Math.max(SCENE_MIN_HEIGHT, pageHeight * SCENE_PAGE_SHARE) };
  return (
    <ScrollView
      alwaysBounceVertical={false}
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.scenePage}
      onLayout={onLayout}
      testID="onboarding-page"
    >
      <View style={sceneSize}>{scene}</View>
      <View style={styles.sceneWords}>
        <PageText title={title} text={text} />
      </View>
    </ScrollView>
  );
}

export interface SettingsPageLayoutProps extends PageTextProps {
  /** A `GroupedList`: it scrolls by itself. */
  children: ReactNode;
  /** A control kept at the bottom of the page, under the list. */
  footer?: ReactNode;
}

/**
 * A page that shows its title and sentence, then a list of settings. The list scrolls by itself,
 * so it cannot sit in a page that scrolls too: at the largest text sizes the words scroll in the
 * space left above the list, which keeps a minimum height (layout.md › Adaptability). The page
 * paints its own background, the grouped one a grouped list sits on (color.md › Mobile).
 */
export function SettingsPageLayout({ title, text, children, footer }: SettingsPageLayoutProps) {
  const colors = useColors();
  return (
    <View
      style={[styles.settingsPage, { backgroundColor: colors.groupedBackground }]}
      testID="onboarding-page"
    >
      <ScrollView
        alwaysBounceVertical={false}
        style={styles.words}
        contentContainerStyle={styles.wordsContent}
      >
        <PageText title={title} text={text} />
      </ScrollView>
      <View style={styles.list}>{children}</View>
      {footer === undefined ? null : <View style={styles.footer}>{footer}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  text: { gap: spacing.sm },
  // The scene runs from the top edge to the side edges; the words follow it.
  scenePage: { flexGrow: 1, paddingBottom: spacing.md, gap: spacing.lg },
  sceneUnmeasured: { flexGrow: 1, minHeight: SCENE_MIN_HEIGHT },
  sceneWords: { paddingHorizontal: layout.screenMargin },
  settingsPage: { flex: 1 },
  // Takes the height of its words, and gives way to the list when the two do not fit.
  words: { flexGrow: 0, flexShrink: 1 },
  wordsContent: { paddingHorizontal: layout.screenMargin, paddingVertical: spacing.md },
  list: { flex: 1, minHeight: LIST_MIN_HEIGHT },
  footer: { paddingHorizontal: layout.screenMargin, paddingVertical: spacing.md },
});
