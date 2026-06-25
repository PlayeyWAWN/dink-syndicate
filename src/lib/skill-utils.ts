import { DUPR_SKILL_LEVELS } from '@/config/dupr-scale';

export type SkillLevel = (typeof DUPR_SKILL_LEVELS)[number]['id'];

/** Map organizer-entered DUPR rating to skill category. */
export function getSkillLevelFromDupr(rating: number | undefined): SkillLevel {
  const value = rating ?? 0;
  if (value >= 5) return 'expert';
  if (value >= 4) return 'advanced';
  if (value >= 3) return 'intermediate';
  return 'beginner';
}

export function formatSkillLevel(level: SkillLevel): string {
  const labels: Record<SkillLevel, string> = {
    beginner: 'Beginner',
    intermediate: 'Intermediate',
    advanced: 'Advanced',
    expert: 'Expert',
  };
  return labels[level];
}

export function skillLevelBadgeClass(level: SkillLevel): string {
  return `skill-badge skill-badge--${level}`;
}
