import { listeningShape } from '../listening-tokens';

// The colours of the voice-following view are roles of the one palette, measured in
// palette.test.ts.

describe('the shapes of the voice-following view', () => {
  it('keeps every control at 44 points or more', () => {
    expect(listeningShape.sceneButtonHit).toBeGreaterThanOrEqual(44);
    expect(listeningShape.followStopDiameter).toBeGreaterThanOrEqual(44);
  });
});
