import type { Media } from "@/lib/types/media";
import type { PostCard } from "@/lib/types/posts";

// Saves and collections returned by the API (API_SPECIFICATION §6).

export type CollectionVisibility = "PRIVATE" | "PUBLIC";

export type CollectionSummary = {
  id: string;
  name: string;
  visibility: CollectionVisibility;
  /** Published posts in the collection. */
  itemCount: number;
  /** Cover of the most recently added published post. */
  coverMedia: Media | null;
};

export type CollectionPage = {
  collection: CollectionSummary & {
    isOwner: boolean;
    /** Shown to others viewing a public collection; null for the owner. */
    owner: { username: string; displayName: string } | null;
  };
  items: PostCard[];
  nextCursor: string | null;
};

export type SaveResult = { saved: true; saveId: string };
