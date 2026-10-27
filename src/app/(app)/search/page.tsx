import type { Metadata } from "next";
import { Suspense } from "react";

import { MasonrySkeleton } from "@/components/posts/masonry-skeleton";
import { SearchBox } from "@/components/search/search-box";
import { SearchView } from "@/components/search/search-view";
import { searchTypeSchema } from "@/lib/schemas/search";

export const metadata: Metadata = {
  title: "Search · dodoi",
};

type SearchParams = PageProps<"/search">["searchParams"];

// Search results (P1-26, SRCH-01…04). The query lives in the address, so results can be shared
// and the back button works.
export default function SearchPage({ searchParams }: PageProps<"/search">) {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5 px-5 pt-3 pb-10 md:px-7 md:pt-8 xl:px-10">
      <h1 className="text-greeting text-foreground md:text-greeting-web">Search</h1>
      <Suspense fallback={<MasonrySkeleton label="Searching" />}>
        <SearchContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function SearchContent({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const q = (typeof params.q === "string" ? params.q : "").trim().slice(0, 100);
  const parsed = searchTypeSchema.safeParse(params.type);
  const type = parsed.success ? parsed.data : "all";
  return (
    <>
      <SearchBox key={q} defaultValue={q} className="md:max-w-xl" />
      <SearchView key={`${q}|${type}`} q={q} type={type} />
    </>
  );
}
