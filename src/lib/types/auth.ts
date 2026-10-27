// Response types for account endpoints (API_SPECIFICATION §3).

export type RegisterResponse = { status: "verification_sent" };

/** 202 from DELETE /api/account: when the account will be deleted (ISO timestamp). */
export type AccountDeletionResponse = { deletionScheduledFor: string };
