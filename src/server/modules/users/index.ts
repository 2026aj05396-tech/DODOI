// Public API of the users module (CODE_QUALITY §3.2): accounts and profiles.
export {
  authenticateWithPassword,
  getAuthUserByAccount,
  getAuthUserById,
  getSessionUser,
  promoteSeedAdminIfMatching,
  resolveGoogleSignIn,
  SIGN_IN_EMAIL_RATE_LIMIT,
  SIGN_IN_IP_RATE_LIMIT,
  type AuthUser,
  type GoogleIdentity,
  type GoogleSignInResult,
  type SessionUser,
} from "./service";
