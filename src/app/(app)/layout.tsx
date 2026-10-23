import { AppShell } from "@/components/layout/app-shell";

// Signed-in area. src/proxy.ts sends signed-out visitors to /sign-in and each page checks the
// session with getActor(). The username for the profile link is wired with the profile UI (P1-14).
export default function AppLayout({ children }: LayoutProps<"/">) {
  return <AppShell username={null}>{children}</AppShell>;
}
