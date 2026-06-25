import { buildStatsExportFilename, sanitizeExportSegment } from '@/lib/export-image';

describe('export-image', () => {
  it('sanitizes session names for filenames', () => {
    expect(sanitizeExportSegment('Jun 24 Open Play!')).toBe('jun-24-open-play');
  });

  it('builds export filenames with scope, suffix and date', () => {
    expect(
      buildStatsExportFilename('Tuesday Night', 'summary', 'session', new Date('2026-06-24T12:00:00.000Z'))
    ).toBe('dink-tuesday-night-session-summary-2026-06-24.png');
    expect(
      buildStatsExportFilename('Tuesday Night', 'rankings', 'career', new Date('2026-06-24T12:00:00.000Z'))
    ).toBe('dink-tuesday-night-career-rankings-2026-06-24.png');
  });
});
