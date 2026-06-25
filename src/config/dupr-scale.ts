/** DUPR skill tiers for organizer-entered queue ratings (not official DUPR). */
export const DUPR_SCALE_TIERS = [
  {
    range: '2.000 – 2.999',
    description: 'Beginner — developing basic shot consistency.',
    skillLevel: 'beginner' as const,
  },
  {
    range: '3.000 – 3.999',
    description: 'Intermediate — improving shot control and strategy.',
    skillLevel: 'intermediate' as const,
  },
  {
    range: '4.000 – 4.999',
    description: 'Advanced — strong tactical execution.',
    skillLevel: 'advanced' as const,
  },
  {
    range: '5.000 – 8.000+',
    description: 'Expert — elite/professional tournament level.',
    skillLevel: 'expert' as const,
  },
] as const;

export const DUPR_SKILL_LEVELS = [
  { id: 'beginner' as const, label: 'Beginner', min: 2, max: 2.999 },
  { id: 'intermediate' as const, label: 'Intermediate', min: 3, max: 3.999 },
  { id: 'advanced' as const, label: 'Advanced', min: 4, max: 4.999 },
  { id: 'expert' as const, label: 'Expert', min: 5, max: 8 },
] as const;
