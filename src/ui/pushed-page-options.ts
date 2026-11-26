import type { ColorValues } from './use-colors';

/**
 * The options of a page pushed over the tabs with the system bar, its title and its back button, a
 * chevron alone (toolbars.md › Navigation; deviations 52 and 101). The bar takes the warm canvas
 * and the title colour of the validated mockups, so it runs into the page under it.
 *
 * The colours are PLAIN values of the appearance in use (`useColorValues`): the navigation bar is
 * configured natively and resolves a dynamic colour once, as light, so that the dark appearance
 * had a cream bar over a dark page. The Proches layout already did this.
 */
export function pushedPageOptions(colors: ColorValues) {
  return {
    headerShown: true,
    headerTintColor: colors.actionTint,
    headerBackButtonDisplayMode: 'minimal',
    headerStyle: { backgroundColor: colors.canvas },
    headerTitleStyle: { color: colors.heading },
    headerShadowVisible: false,
    contentStyle: { backgroundColor: colors.canvas },
  } as const;
}
