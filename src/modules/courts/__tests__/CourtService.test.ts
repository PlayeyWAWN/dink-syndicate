import { CourtService } from '@/modules/courts/CourtService';

describe('CourtService', () => {
  const service = new CourtService();

  it('ensures default court count', () => {
    const courts = service.ensureCourts([], 4);
    expect(courts).toHaveLength(4);
    expect(courts[0].label).toBe('1');
  });

  it('assigns match to court slot', () => {
    const courts = service.ensureCourts([], 2);
    const next = service.assignMatch(courts, 'court-1', 'match-99');
    expect(next[0].activeMatchId).toBe('match-99');
  });

  it('adds a court with default numeric label', () => {
    const courts = service.ensureCourts([], 2);
    const next = service.addCourt(courts);
    expect(next).toHaveLength(3);
    expect(next[2].label).toBe('3');
  });

  it('adds a court with custom label', () => {
    const courts = service.ensureCourts([], 1);
    const next = service.addCourt(courts, 'Center Court');
    expect(next[1].label).toBe('Center Court');
  });

  it('renames a court', () => {
    const courts = service.ensureCourts([], 1);
    const next = service.renameCourt(courts, 'court-1', 'Main');
    expect(next[0].label).toBe('Main');
  });

  it('removes a court by id', () => {
    const courts = service.ensureCourts([], 3);
    const next = service.removeCourt(courts, 'court-2');
    expect(next).toHaveLength(2);
    expect(next.map((court) => court.id)).toEqual(['court-1', 'court-3']);
  });

  it('ignores remove for unknown court id', () => {
    const courts = service.ensureCourts([], 2);
    const next = service.removeCourt(courts, 'court-missing');
    expect(next).toBe(courts);
  });
});
