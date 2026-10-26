import type { Metadata } from "next";
import Link from "next/link";

import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { LandingCraftTiles, WelcomeCraftTiles } from "@/components/marketing/craft-tiles";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/ui/wordmark";

export const metadata: Metadata = {
  title: "dodoi · For the things you love making",
  description:
    "Find ideas, try new crafts and share what you make. Beginners welcome. No experience needed.",
};

const HEADLINE = "For the things you love making, and all the things you haven't tried yet.";

const HIGHLIGHTS = [
  { title: "Discover", detail: "Ideas across 40+ crafts" },
  { title: "Create", detail: "Share progress, not perfection" },
  { title: "Connect", detail: "Ask, help, make together" },
];

// Signed-out entry: Welcome (design 1a) below 1024px, Landing (design 2a) from 1024px. Each
// layout is rendered and the other hidden with CSS (display: none also hides it from assistive
// technology), because they differ too much to morph one into the other.
export default function WelcomePage() {
  return (
    <>
      <MobileWelcome />
      <WebLanding />
    </>
  );
}

function MobileWelcome() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 pt-5 pb-9 md:justify-center md:py-12 lg:hidden">
      <Wordmark />
      <WelcomeCraftTiles className="mt-6" />
      <div className="flex flex-col gap-3 pt-8">
        <h1 className="text-hero text-balance text-foreground">{HEADLINE}</h1>
        <p className="text-body-lg text-foreground-secondary">
          Find ideas, try new crafts and share what you make. Beginners welcome.
        </p>
      </div>
      <div className="mt-auto flex flex-col gap-2.5 pt-10 md:mt-0">
        <GoogleSignInButton returnTo="/" />
        <Button asChild variant="outline" size="lg" className="bg-background">
          <Link href="/sign-up">Sign up with email</Link>
        </Button>
        <p className="pt-1.5 text-center text-body text-foreground-secondary">
          Already making with us?{" "}
          <Link href="/sign-in" className="font-bold text-link hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}

function WebLanding() {
  return (
    <div className="hidden min-h-dvh flex-col lg:flex">
      <header className="mx-auto flex h-19 w-full max-w-screen-2xl items-center justify-between px-14">
        <Wordmark />
        {/* Design 2a shows these product areas as plain labels; they become links as they ship. */}
        <ul
          aria-label="What you can do on dodoi"
          className="flex gap-8 text-body-lg text-foreground"
        >
          <li>Discover</li>
          <li>Learn</li>
          <li>Community</li>
          <li>Companion</li>
        </ul>
        <div className="flex gap-2.5">
          <Button asChild variant="outline">
            <Link href="/sign-in">Log in</Link>
          </Button>
          <Button asChild>
            <Link href="/sign-up">Join free</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-screen-2xl flex-1 grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] items-start gap-14 px-14 pt-10 pb-14">
        <div className="flex flex-col gap-5.5 pt-10">
          <span className="self-start rounded-full bg-lavender px-3 py-1.5 text-overline text-plum uppercase">
            A creative space for curious makers
          </span>
          <h1 className="text-title-web text-balance text-foreground xl:text-hero-web">
            {HEADLINE}
          </h1>
          <p className="max-w-125 text-body-lg-web text-foreground-secondary">
            Discover ideas, try a new craft, keep a journal of what you make and learn from people
            who make things too. No experience needed.
          </p>
          <div className="flex gap-3 pt-1.5">
            <GoogleSignInButton returnTo="/" className="h-14 w-auto px-7 text-control-xl" />
            <Button asChild variant="outline" size="xl">
              <Link href="/sign-up">Sign up with email</Link>
            </Button>
          </div>
          <dl className="mt-3 flex gap-7 border-t border-border pt-6">
            {HIGHLIGHTS.map((item) => (
              <div key={item.title} className="flex flex-col gap-0.5">
                <dt className="text-control-xl font-bold text-foreground">{item.title}</dt>
                <dd className="text-body text-muted-foreground">{item.detail}</dd>
              </div>
            ))}
          </dl>
        </div>
        <LandingCraftTiles />
      </main>
    </div>
  );
}
