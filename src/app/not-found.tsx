import Link from "next/link";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center">
      <EmptyState
        title="We couldn't find that page"
        titleAs="h1"
        description="It may have moved, or it might not be ready yet."
        action={
          <Button asChild>
            <Link href="/">Go to dodoi</Link>
          </Button>
        }
      />
    </main>
  );
}
