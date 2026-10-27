import { z } from "zod";

export const windowItemSchema = z.object({
  day_of_week: z
    .number()
    .int()
    .min(0, "Day must be between 0 (Sunday) and 6 (Saturday)")
    .max(6, "Day must be between 0 (Sunday) and 6 (Saturday)"),
  start_time: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Start time must be in "HH:MM" 24-hour format'),
  end_time: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'End time must be in "HH:MM" 24-hour format'),
});

export const updateAvailabilitySchema = z.object({
  windows: z.array(windowItemSchema),
});

export type UpdateAvailabilityInput = z.infer<typeof updateAvailabilitySchema>;
export type WindowItemInput = z.infer<typeof windowItemSchema>;
