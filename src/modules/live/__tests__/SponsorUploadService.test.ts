import {
  isManagedSponsorLogoUrl,
  parseSponsorLogoStoragePath,
} from '@/modules/live/SponsorUploadService';

describe('parseSponsorLogoStoragePath', () => {
  it('parses standard Firebase download URLs', () => {
    const url =
      'https://firebasestorage.googleapis.com/v0/b/my-app.appspot.com/o/sponsors%2Fben-the-sponsor.webp?alt=media&token=abc';
    expect(parseSponsorLogoStoragePath(url)).toBe('sponsors/ben-the-sponsor.webp');
    expect(isManagedSponsorLogoUrl(url)).toBe(true);
  });

  it('returns null for external URLs', () => {
    expect(parseSponsorLogoStoragePath('https://example.com/logo.png')).toBeNull();
    expect(isManagedSponsorLogoUrl('https://example.com/logo.png')).toBe(false);
  });

  it('returns null for non-sponsor storage paths', () => {
    const url =
      'https://firebasestorage.googleapis.com/v0/b/my-app.appspot.com/o/users%2Favatar.webp?alt=media';
    expect(parseSponsorLogoStoragePath(url)).toBeNull();
  });
});
