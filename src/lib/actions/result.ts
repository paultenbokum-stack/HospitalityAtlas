import { ZodError } from "zod";
import { AccessError } from "@/lib/session";

export type Result<T = null> = { ok: true; data: T } | { ok: false; error: string };

export class UserError extends Error {}

// Wraps a server action body so expected failures (validation, access, business rules)
// come back as `{ ok: false, error }` instead of throwing into the client.
export async function run<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    if (e instanceof UserError || e instanceof AccessError) return { ok: false, error: e.message };
    if (e instanceof ZodError) return { ok: false, error: e.issues[0]?.message ?? "Invalid input" };
    console.error(e);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}
