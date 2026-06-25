import { z } from 'zod';

export const CourtSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  activeMatchId: z.string().nullable().default(null),
});

export type Court = z.infer<typeof CourtSchema>;

/** Default display name for a new court slot (1, 2, 3, …). */
export function defaultCourtLabel(index: number): string {
  return String(index + 1);
}

export function createCourt(index: number, label?: string): Court {
  return CourtSchema.parse({
    id: `court-${index + 1}`,
    label: label?.trim() || defaultCourtLabel(index),
    activeMatchId: null,
  });
}
