// Public API of the reports module (CODE_QUALITY §3.2): reporting and moderation (P1-28b, P2-08).
export {
  actOnReport,
  changeModeratorRole,
  createReport,
  listReportGroups,
  REPORT_RATE_LIMIT,
} from "./service";
