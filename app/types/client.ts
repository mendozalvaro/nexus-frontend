import { z } from "zod";

export const jsonRecordSchema = z.record(z.string(), z.unknown());

export const clientSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid().nullable(),
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().nullable(),
  phone: z.string().trim().nullable(),
  email: z.string().trim().email().nullable(),
  billingData: jsonRecordSchema,
  preferences: jsonRecordSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}).strict();

export const clientOrgSchema = z.object({
  clientId: z.string().uuid(),
  organizationId: z.string().uuid(),
  status: z.enum(["active", "inactive", "blocked"]),
  billingData: jsonRecordSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}).strict();

export const clientUpsertSchema = z.object({
  firstName: z.string().trim().min(1, "El nombre es obligatorio."),
  lastName: z.string().trim().max(120).optional().nullable(),
  phone: z.string().trim().min(7).max(30).optional().nullable(),
  email: z.string().trim().email().optional().nullable(),
  billingData: jsonRecordSchema.optional(),
  preferences: jsonRecordSchema.optional(),
  organizationId: z.string().uuid().optional().nullable(),
}).strict();

export interface Client {
  id: string;
  userId: string | null;
  firstName: string;
  lastName: string | null;
  phone: string | null;
  email: string | null;
  billingData: Record<string, unknown>;
  preferences: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ClientOrg {
  clientId: string;
  organizationId: string;
  status: "active" | "inactive" | "blocked";
  billingData: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ClientProfileState {
  clientId: string;
  organizationId: string;
  orgStatus: "active" | "inactive" | "blocked";
  firstName: string;
  lastName: string | null;
  phone: string | null;
  email: string | null;
  billingData: Record<string, unknown>;
  preferences: Record<string, unknown>;
}
