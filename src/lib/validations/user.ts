import { z } from "zod";

import { Role } from "@/generated/prisma/enums";
import { optionalString } from "@/lib/validations/common";

/**
 * Password policy. Deliberately length-first rather than a composition rule
 * (one upper, one digit, one symbol): length is what actually resists offline
 * cracking, and composition rules push people towards `Password1!`.
 */
const password = z
  .string()
  .min(12, "Password must be at least 12 characters.")
  .max(200, "Password must be 200 characters or fewer.");

export const userCreateSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email is required.")
    .email("Must be a valid email address.")
    // Stored lowercase so Ben@x.com and ben@x.com cannot both exist.
    .transform((v) => v.toLowerCase()),
  name: optionalString(120),
  role: z.enum(Role),
  password,
});

export type UserCreateInput = z.infer<typeof userCreateSchema>;

export const userUpdateSchema = z.object({
  id: z.string().min(1),
  name: optionalString(120).optional(),
  role: z.enum(Role).optional(),
  password: password.optional(),
});

export type UserUpdateInput = z.infer<typeof userUpdateSchema>;

/**
 * Self-registration. No role field: the service always assigns VIEWER, so a
 * crafted payload cannot ask for ANALYST.
 */
export const registerSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email is required.")
    .email("Must be a valid email address.")
    .transform((v) => v.toLowerCase()),
  name: optionalString(120),
  password,
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password."),
  newPassword: password,
});

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
