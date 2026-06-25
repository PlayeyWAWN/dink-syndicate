import {
  EXPORT_LOGO_MAX_WIDTH,
  EXPORT_LOGO_PREFERRED_HEIGHT,
  fitLogoToBox,
} from '@/lib/export-logo';

describe('export-logo', () => {
  it('fits a square logo to prominent export dimensions', () => {
    expect(fitLogoToBox(500, 500, 240, 220)).toEqual({ width: 220, height: 220 });
  });

  it('documents the prior regression cap that made the logo tiny', () => {
    expect(fitLogoToBox(500, 500, 180, 68)).toEqual({ width: 68, height: 68 });
  });

  it('fits a wide logo by width when height allows more room', () => {
    expect(fitLogoToBox(800, 400, 240, 220)).toEqual({ width: 240, height: 120 });
  });

  it('uses preferred constants for the default prominent target', () => {
    expect(EXPORT_LOGO_MAX_WIDTH).toBe(240);
    expect(EXPORT_LOGO_PREFERRED_HEIGHT).toBe(220);
  });
});
