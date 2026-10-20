// The authenticated user performing an action, passed explicitly to every service function
// (CODE_QUALITY §4.3). `null` means signed out. Built from the Auth.js session in P1-04.

export type Role = "USER" | "ADMIN";

export type AuthenticatedActor = {
  id: string;
  role: Role;
};

export type Actor = AuthenticatedActor | null;
