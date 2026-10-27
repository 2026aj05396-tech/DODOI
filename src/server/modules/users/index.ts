// Public API of the users module (CODE_QUALITY §3.2): accounts and profiles.
export { confirmAge } from "./age-check";
export {
  getCreatorProfiles,
  getDisplayName,
  getPublicProfile,
  searchCreators,
  getUserIdByUsername,
  getUsernames,
  type CreatorProfile,
} from "./creators";
export { completeOnboarding, getOnboardingState, setOnboardingStep } from "./onboarding";
export {
  getOwnProfile,
  getProfileForView,
  getProfileSkills,
  showsUsernamePrompt,
  updateOwnProfile,
  usernameChangeAvailableAt,
  type OwnProfileRow,
  type ProfileForView,
} from "./profile";
export { getInterestProfile, getMySkills, replaceMySkills } from "./user-skills";
export {
  changePassword,
  PASSWORD_CHANGE_RATE_LIMIT,
  PASSWORD_RESET_EMAIL_RATE_LIMIT,
  PASSWORD_RESET_IP_RATE_LIMIT,
  requestPasswordReset,
  resetPassword,
} from "./passwords";
export {
  REGISTER_RATE_LIMIT,
  registerWithPassword,
  RESEND_VERIFICATION_RATE_LIMIT,
  resendVerificationEmail,
  verifyEmail,
} from "./registration";
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
  type PasswordSignInResult,
  type SessionUser,
} from "./service";
