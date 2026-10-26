import { z } from "zod";

export const RoleEnum = z.enum(["driver", "host"]);
export type UserRole = z.infer<typeof RoleEnum>;

export const SignUpSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters long"),
  email: z.string().trim().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters long"),
  role: RoleEnum,
  phone: z.string().trim().optional().or(z.literal("")),
});

export type SignUpInput = z.infer<typeof SignUpSchema>;

export const LogInSchema = z.object({
  email: z.string().trim().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export type LogInInput = z.infer<typeof LogInSchema>;
