import { z } from "zod";
import { ConnectorTypeEnum } from "./search";
import { APP_CURRENCY, validateWeeklyWindows } from "@/lib/rules";

export const HostConnectionTypeEnum = z.enum([
  "domestic",
  "commercial",
  "dedicated_ev",
]);
export type HostConnectionType = z.infer<typeof HostConnectionTypeEnum>;

export const HOST_CONNECTION_LABELS: Record<HostConnectionType, string> = {
  domestic: "Domestic (Home Socket)",
  commercial: "Commercial Complex",
  dedicated_ev: "Dedicated EV Metered Connection",
};

/**
 * One weekly availability window as submitted by a host.
 * `day_of_week` follows the database convention: 0 = Sunday .. 6 = Saturday.
 * Times are local wall-clock values in the app timezone (Asia/Kolkata).
 */
export const WINDOW_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export const AvailabilityWindowSchema = z.object({
  day_of_week: z
    .number()
    .int("day_of_week must be a whole number")
    .min(0, "day_of_week must be between 0 (Sunday) and 6 (Saturday)")
    .max(6, "day_of_week must be between 0 (Sunday) and 6 (Saturday)"),
  start_time: z
    .string()
    .regex(WINDOW_TIME_PATTERN, 'Start time must be 24-hour "HH:MM", for example 06:30'),
  end_time: z
    .string()
    .regex(WINDOW_TIME_PATTERN, 'End time must be 24-hour "HH:MM", for example 22:30'),
});

export type AvailabilityWindowInput = z.infer<typeof AvailabilityWindowSchema>;

const BaseCreateChargerSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Title must be at least 3 characters")
    .max(100, "Title cannot exceed 100 characters"),
  address_text: z
    .string()
    .trim()
    .min(5, "Address must be at least 5 characters")
    .max(500, "Address cannot exceed 500 characters"),
  latitude: z.coerce
    .number()
    .min(-90, "Latitude must be between -90 and 90")
    .max(90, "Latitude must be between -90 and 90"),
  longitude: z.coerce
    .number()
    .min(-180, "Longitude must be between -180 and 180")
    .max(180, "Longitude must be between -180 and 180"),
  connector_type: ConnectorTypeEnum,
  power_kw: z.coerce
    .number()
    .positive("Power rating must be greater than 0 kW")
    .max(350, "Power rating cannot exceed 350 kW"),
  price_per_hour: z.coerce
    .number()
    .min(0, `Price per hour cannot be negative (${APP_CURRENCY})`)
    .max(5000, `Price per hour cannot exceed 5000 ${APP_CURRENCY}`),
  notes: z
    .string()
    .trim()
    .max(1000, "Notes cannot exceed 1000 characters")
    .optional()
    .nullable()
    .transform((val) => (val && val.length > 0 ? val : null)),
  host_connection_type: HostConnectionTypeEnum.default("domestic"),
  electricity_permission_acknowledged: z.literal(true, {
    errorMap: () => ({
      message:
        "You must confirm permission with your electricity provider that your connection allows charging other vehicles.",
    }),
  }),
  windows: z
    .array(AvailabilityWindowSchema)
    .min(1, "Add at least one weekly availability window so drivers can find your charger."),
});

/**
 * Validation schema for creating or editing a charging point.
 * All constraints follow the business rules and domain bounds. The weekly
 * availability pattern is checked against the same rules the database enforces.
 */
export const CreateChargerSchema = BaseCreateChargerSchema.superRefine((value, ctx) => {
  const windowsResult = validateWeeklyWindows(
    value.windows.map((w) => ({
      dayOfWeek: w.day_of_week,
      startTime: w.start_time,
      endTime: w.end_time,
    }))
  );

  if (!windowsResult.success) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: windowsResult.error.message,
      path: ["windows"],
    });
  }
});

export type CreateChargerInput = z.infer<typeof CreateChargerSchema>;

/**
 * Explicit allow-list schema for updating an existing charger.
 * host_id and created_at can NEVER be supplied or updated from the request body.
 */
export const UpdateChargerSchema = CreateChargerSchema;
export type UpdateChargerInput = z.infer<typeof UpdateChargerSchema>;

/**
 * Schema for toggling a charger's active state.
 * Reactivating a charger requires confirming electricity permission.
 */
export const ToggleChargerStatusSchema = z.object({
  is_active: z.boolean({
    required_error: "is_active boolean state is required",
  }),
  electricity_permission_acknowledged: z.boolean().optional(),
}).refine(
  (data) => {
    // If activating, electricity_permission_acknowledged must be true
    if (data.is_active) {
      return data.electricity_permission_acknowledged === true;
    }
    return true;
  },
  {
    message: "You must confirm electricity provider permission to reactivate this charger.",
    path: ["electricity_permission_acknowledged"],
  }
);

export type ToggleChargerStatusInput = z.infer<typeof ToggleChargerStatusSchema>;
