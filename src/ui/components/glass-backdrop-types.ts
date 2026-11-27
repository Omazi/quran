/** What the glass under a piece floating over the home garden is drawn from. */
export interface GlassBackdropProps {
  /** The appearance of the glass: night values over a night sky, whatever the device's. */
  appearance: 'light' | 'dark';
  /** The corner radius of the piece. */
  radius: number;
  /** The opacity of the tint where the app draws the glass itself (`glassVeilMinimum`). */
  veil: number;
}
