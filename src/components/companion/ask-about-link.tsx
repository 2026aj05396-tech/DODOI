import { Sparkles } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

/**
 * "Ask about this" on a post and "What is this and how do I start?" on a skill page (F-23 step 1):
 * opens a new chat about the one post or skill. Signed-out visitors are sent to sign in first.
 */
export function AskAboutLink({
  target,
  label,
  className,
}: {
  target: { post: string } | { skill: string };
  label: string;
  className?: string;
}) {
  const query = "post" in target ? `post=${target.post}` : `skill=${target.skill}`;
  return (
    <Button asChild variant="outline" className={className}>
      <Link href={`/companion/new?${query}`}>
        <Sparkles aria-hidden className="size-4" />
        {label}
      </Link>
    </Button>
  );
}
