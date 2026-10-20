"use client";

import { Bell, Bookmark, Inbox, Plus, Sparkles, Video } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { ActionChip, Tag, ToggleChip } from "@/components/ui/chip";
import { ComingSoonBadge, ComingSoonCard } from "@/components/ui/coming-soon";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorBanner } from "@/components/ui/error-banner";
import { ErrorState } from "@/components/ui/error-state";
import { FieldError } from "@/components/ui/field-error";
import { Input, Label } from "@/components/ui/input";
import { PATTERN_ACCENTS, PatternTile } from "@/components/ui/pattern-tile";
import { SearchField } from "@/components/ui/search-field";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { showToast, Toaster } from "@/components/ui/toast";
import { Wordmark } from "@/components/ui/wordmark";

const FEED_FILTERS = ["For you", "Crochet", "Watercolor", "New to you"];
const INTERESTS = ["Drawing", "Crochet", "Embroidery", "Pipe cleaner art"];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 border-b border-border py-8">
      <h2 className="text-overline text-muted-foreground uppercase">{title}</h2>
      {children}
    </section>
  );
}

export function UiPreview() {
  const [activeFilter, setActiveFilter] = useState("For you");
  const [selectedInterests, setSelectedInterests] = useState<string[]>(["Crochet"]);

  function toggleInterest(name: string, isSelected: boolean) {
    setSelectedInterests((current) =>
      isSelected ? [...current, name] : current.filter((interest) => interest !== name),
    );
  }

  return (
    <main className="mx-auto flex max-w-5xl flex-col px-5 pb-24 md:px-8">
      <header className="flex items-center justify-between gap-4 py-8">
        <Wordmark />
        <Wordmark variant="monogram" />
      </header>
      <h1 className="text-title md:text-title-web">UI primitives</h1>

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-3">
          <Button size="lg">Continue with Google</Button>
          <Button variant="outline" size="lg">
            Sign up with email
          </Button>
          <Button variant="inverse">
            <Sparkles aria-hidden className="size-4 text-butter" />
            Ask dodoi
          </Button>
          <Button variant="text">See all</Button>
          <Button size="sm">
            <Plus aria-hidden className="size-4" />
            Create
          </Button>
          <Button size="lg" disabled>
            Pick 2 more to continue
          </Button>
        </div>
      </Section>

      <Section title="Chips">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Feed filters">
          {FEED_FILTERS.map((filter) => (
            <ToggleChip
              key={filter}
              pressed={activeFilter === filter}
              onPressedChange={() => setActiveFilter(filter)}
            >
              {filter}
            </ToggleChip>
          ))}
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Interests">
          {INTERESTS.map((interest) => (
            <ToggleChip
              key={interest}
              variant="interest"
              pressed={selectedInterests.includes(interest)}
              onPressedChange={(isSelected) => toggleInterest(interest, isSelected)}
            >
              {interest}
            </ToggleChip>
          ))}
          <ActionChip variant="add">+ Add your own</ActionChip>
        </div>
        <div className="flex flex-wrap gap-2">
          <Tag variant="skill">Pipe cleaner art</Tag>
          <Tag>Beginner</Tag>
          <Tag>45 min</Tag>
          <ActionChip>Make a materials checklist</ActionChip>
        </div>
      </Section>

      <Section title="Fields">
        <div className="grid gap-4 md:grid-cols-2">
          <SearchField label="Search" placeholder="Skills, projects, makers" />
          <SearchField label="Search on web" appearance="outline" placeholder="Search" />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="preview-email">Email</Label>
            <Input
              id="preview-email"
              type="email"
              defaultValue="aanya@gmail"
              aria-invalid
              aria-describedby="preview-email-error"
            />
            <FieldError id="preview-email-error">
              Add the part after the @, like gmail.com
            </FieldError>
          </div>
          <ErrorBanner>
            Couldn&apos;t upload your photo. Check your connection and try again.
          </ErrorBanner>
        </div>
      </Section>

      <Section title="Tabs">
        <Tabs defaultValue="collections">
          <TabsList aria-label="Profile sections">
            <TabsTrigger value="projects">Projects</TabsTrigger>
            <TabsTrigger value="collections">Collections</TabsTrigger>
            <TabsTrigger value="posts">Posts</TabsTrigger>
          </TabsList>
          <TabsContent value="projects" className="pt-4 text-body">
            Projects
          </TabsContent>
          <TabsContent value="collections" className="pt-4 text-body">
            Collections
          </TabsContent>
          <TabsContent value="posts" className="pt-4 text-body">
            Posts
          </TabsContent>
        </Tabs>
      </Section>

      <Section title="Dialog, sheet, toast">
        <div className="flex flex-wrap gap-3">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">Open dialog</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogTitle>Delete &quot;Gift ideas&quot;?</DialogTitle>
              <DialogDescription>Saved posts will stay in All saved.</DialogDescription>
            </DialogContent>
          </Dialog>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">Open sheet</Button>
            </DialogTrigger>
            <DialogContent layout="sheet">
              <DialogTitle>Add to collection</DialogTitle>
              <DialogDescription>Choose where to keep this idea.</DialogDescription>
            </DialogContent>
          </Dialog>
          <Button
            variant="outline"
            onClick={() =>
              showToast({
                message: "Saved! Add it to a collection?",
                action: { label: "Undo", onAction: () => undefined },
              })
            }
          >
            Show toast
          </Button>
        </div>
      </Section>

      <Section title="Coming soon">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Bell aria-hidden className="size-5" />
            <ComingSoonBadge size="sm" />
          </span>
          <ComingSoonBadge />
        </div>
        <ComingSoonCard
          icon={<Video />}
          title="Live sessions"
          description="Book a 30-min call with a maker. We'll let you know when this opens."
        />
      </Section>

      <Section title="Patterns and loading">
        <div className="grid grid-cols-3 gap-3 md:grid-cols-7">
          {PATTERN_ACCENTS.map((accent) => (
            <PatternTile key={accent} accent={accent} className="h-24" />
          ))}
          <PatternTile accent="new-to-you" className="h-24" />
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Skeleton className="h-40" />
          <Skeleton className="h-28" />
        </div>
      </Section>

      <Section title="States">
        <div className="grid gap-4 md:grid-cols-2">
          <EmptyState
            icon={<Inbox />}
            title="Nothing here yet"
            description="Explore some ideas and save the ones you love."
            action={
              <Button size="sm">
                <Bookmark aria-hidden className="size-4" />
                Explore ideas
              </Button>
            }
          />
          <ErrorState onRetry={() => undefined} />
        </div>
      </Section>

      <Toaster />
    </main>
  );
}
