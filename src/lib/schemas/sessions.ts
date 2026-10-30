import { z } from "zod";

// API contracts for creative sessions (API_SPECIFICATION §9.3, P3-04; SES-01…05).

export const SESSION_DURATIONS = [15, 30, 45, 60] as const;
export const SESSION_NOTE_MAX = 300;
export const SESSION_LINK_MAX = 500;
/** SES-03: a proposed or new time must be at least this far ahead. */
export const SESSION_MIN_LEAD_MS = 60 * 60 * 1000;

const id = z.string().min(1).max(40);

/** https only, a real host, no embedded password: dodoi only ever links out (OD-03, SES-01). */
export const meetingUrlSchema = z
  .string()
  .trim()
  .min(1, "Add the meeting link.")
  .max(SESSION_LINK_MAX, `Keep the link to ${SESSION_LINK_MAX} characters or fewer.`)
  .refine((value) => {
    try {
      const url = new URL(value);
      return (
        url.protocol === "https:" &&
        url.hostname.includes(".") &&
        url.username === "" &&
        url.password === ""
      );
    } catch {
      return false;
    }
  }, "Use a link that starts with https://, such as a Google Meet or Zoom link.");

const durationSchema = z
  .number()
  .int()
  .refine(
    (value): value is (typeof SESSION_DURATIONS)[number] =>
      (SESSION_DURATIONS as readonly number[]).includes(value),
    "Choose 15, 30, 45 or 60 minutes.",
  );

/** The time as an ISO string with a zone (the browser sends UTC). */
const startsAtSchema = z.iso.datetime({ offset: true, message: "Choose a date and time." });

const noteSchema = z
  .string()
  .trim()
  .max(SESSION_NOTE_MAX, `Keep the note to ${SESSION_NOTE_MAX} characters or fewer.`)
  .optional()
  .transform((value) => (value ? value : undefined));

/** POST /api/sessions: propose a session to a member (SES-01). */
export const proposeSessionSchema = z.object({
  inviteeUsername: z.string().trim().min(1).max(40),
  startsAt: startsAtSchema,
  durationMin: durationSchema,
  note: noteSchema,
  meetingUrl: meetingUrlSchema,
  helpRequestId: id.optional(),
});
export type ProposeSessionInput = z.output<typeof proposeSessionSchema>;

/** PATCH /api/sessions/{id}: answer, cancel or suggest another time (SES-02). */
export const sessionActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("ACCEPT") }),
  z.object({ action: z.literal("DECLINE") }),
  z.object({ action: z.literal("CANCEL") }),
  z.object({
    action: z.literal("RESCHEDULE"),
    startsAt: startsAtSchema,
    meetingUrl: meetingUrlSchema.optional(),
  }),
]);
export type SessionActionInput = z.output<typeof sessionActionSchema>;

export const sessionScopeSchema = z.enum(["upcoming", "past"]);
export const sessionListQuerySchema = z.object({
  scope: sessionScopeSchema.default("upcoming"),
  cursor: z.string().max(500).optional(),
});
export type SessionListQuery = z.output<typeof sessionListQuerySchema>;

export const sessionIdParamsSchema = z.object({ id });
