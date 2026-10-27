// Public API of the admin module (CODE_QUALITY §3.2): the audit log. Reports live in the
// `reports` module (it hides skills and profiles, which import this module).
export { recordAudit, type AuditEntry } from "./service";
