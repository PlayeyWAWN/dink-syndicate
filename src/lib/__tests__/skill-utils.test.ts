import { getSkillLevelFromDupr, formatSkillLevel } from '@/lib/skill-utils';

describe('skill-utils', () => {
  it('maps DUPR ranges to skill levels', () => {
    expect(getSkillLevelFromDupr(2.5)).toBe('beginner');
    expect(getSkillLevelFromDupr(3.5)).toBe('intermediate');
    expect(getSkillLevelFromDupr(4.5)).toBe('advanced');
    expect(getSkillLevelFromDupr(5.5)).toBe('expert');
  });

  it('formats skill level labels', () => {
    expect(formatSkillLevel('beginner')).toBe('Beginner');
    expect(formatSkillLevel('expert')).toBe('Expert');
  });
});
