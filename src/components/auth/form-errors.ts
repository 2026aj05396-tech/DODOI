import type { z } from "zod";

/** First message per top-level field, for showing Zod results next to inputs. */
export function firstIssuePerField<TField extends string>(
  issues: readonly z.core.$ZodIssue[],
  fields: readonly TField[],
): Partial<Record<TField, string>> {
  const errors: Partial<Record<TField, string>> = {};
  for (const issue of issues) {
    const field = issue.path[0];
    if (typeof field === "string" && (fields as readonly string[]).includes(field)) {
      errors[field as TField] ??= issue.message;
    }
  }
  return errors;
}
