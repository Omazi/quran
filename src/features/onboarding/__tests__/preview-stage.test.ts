import { previewStageOf } from '../preview-stage';

describe('the garden shown above the settings (previewStageOf)', () => {
  it('shows the largest stage of the prototype that a month at the chosen pace reaches', () => {
    expect(previewStageOf(60)).toBe(60);
    expect(previewStageOf(59)).toBe(40);
    expect(previewStageOf(20)).toBe(20);
    expect(previewStageOf(19)).toBe(8);
    expect(previewStageOf(5)).toBe(5);
    expect(previewStageOf(2)).toBe(2);
    expect(previewStageOf(1)).toBe(0);
    expect(previewStageOf(0)).toBe(0);
  });
});
