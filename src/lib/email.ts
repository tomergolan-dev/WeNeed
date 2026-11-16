import { z } from "zod";

/** Trims and lowercases an email address; null if it isn't one. */
export function normalizeEmail(input: string): string | null {
  const email = input.trim().toLowerCase();
  return z.email().safeParse(email).success ? email : null;
}
