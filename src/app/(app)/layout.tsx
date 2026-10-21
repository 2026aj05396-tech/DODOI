import { AppShell } from "@/components/layout/app-shell";

// Signed-in area. The session (P1-04) will supply the username and protect these routes.
export default function AppLayout({ children }: LayoutProps<"/">) {
  return <AppShell username={null}>{children}</AppShell>;
}
