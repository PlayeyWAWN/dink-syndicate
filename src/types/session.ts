import { z } from 'zod';

export const SessionSchema = z.object({
  id: z.string().min(1),
  organizerName: z.string().min(1),
  /** Present when signed in via Firebase Auth. */
  email: z.string().email().optional(),
  role: z.enum(['queue_master', 'organizer', 'viewer']).default('queue_master'),
  createdAt: z.number().int().nonnegative(),
});

export type Session = z.infer<typeof SessionSchema>;

export type Unsubscribe = () => void;
