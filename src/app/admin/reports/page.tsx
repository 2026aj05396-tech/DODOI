import { ReportList } from "@/components/admin/report-list";

// Admin reports (P1-28b, RPT-04). The admin layout has already checked the role; the list loads
// in the browser (it changes as admins act).
export default function AdminReportsPage() {
  return <ReportList />;
}
