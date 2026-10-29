import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";

import { AdminHeader } from "@/components/admin/admin-header";
import { Skeleton } from "@/components/ui/skeleton";
import { getActor } from "@/server/auth";

export const metadata: Metadata = {
  title: "Admin · dodoi",
  robots: { index: false, follow: false },
};

// Admin area (P1-17, ADM-04). The proxy already sends non-admins to the 404 page; this checks the
// session against the database before anything renders.
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-6xl p-8">
          <Skeleton className="h-96 w-full rounded-md" />
        </div>
      }
    >
      <AdminFrame>{children}</AdminFrame>
    </Suspense>
  );
}

async function AdminFrame({ children }: { children: ReactNode }) {
  const actor = await getActor();
  if (actor?.role !== "ADMIN" && actor?.role !== "MODERATOR") notFound();
  return (
    <div className="min-h-dvh">
      <AdminHeader isModerator={actor.role === "MODERATOR"} />
      <main className="mx-auto max-w-6xl px-5 py-6 md:px-8 md:py-10">{children}</main>
    </div>
  );
}
