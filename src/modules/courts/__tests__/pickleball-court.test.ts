import { renderPickleballCourtSvg } from '@/modules/courts/pickleball-court';

describe('pickleball-court', () => {
  it('renders SVG with kitchen zones', () => {
    const svg = renderPickleballCourtSvg({ active: true, label: 'Court 1' });
    expect(svg).toContain('<svg');
    expect(svg).toContain('Court 1');
    expect(svg).toContain('viewBox="0 0 520 280"');
    expect(svg).toContain('rgba(56, 189, 248');
  });
});
