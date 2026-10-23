import { NextRequest } from "next/server";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { getActor } from "@/server/auth";
import { db } from "@/server/db/client";

import * as skillDetailRoute from "../../src/app/api/skills/[slug]/route";
import * as skillsRoute from "../../src/app/api/skills/route";
import { resetDatabase } from "../helpers/database";
import { actorFor, createSkill, createUser } from "../helpers/factories";

// Skills routes wired in P1-04 (API_SPECIFICATION §4): auth, status codes and response bodies.
// The session normally comes from Auth.js; here the actor is set directly.
vi.mock("@/server/auth", () => ({ getActor: vi.fn() }));
const mockedGetActor = vi.mocked(getActor);

const ORIGIN = "http://localhost:3000";
const noParams = { params: Promise.resolve({}) };

function get(path: string): NextRequest {
  return new NextRequest(`${ORIGIN}${path}`);
}

function post(path: string, body: unknown): NextRequest {
  return new NextRequest(`${ORIGIN}${path}`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json", origin: ORIGIN, host: "localhost:3000" },
  });
}

describe("skills routes", () => {
  beforeEach(async () => {
    await resetDatabase();
    mockedGetActor.mockResolvedValue(null);
  });

  afterAll(async () => {
    await resetDatabase();
    await db.$disconnect();
  });

  it("answers 401 to signed-out callers", async () => {
    const list = await skillsRoute.GET(get("/api/skills"), noParams);
    const create = await skillsRoute.POST(post("/api/skills", { name: "Crochet" }), noParams);

    expect(list.status).toBe(401);
    expect(create.status).toBe(401);
  });

  it("lists active skills for a signed-in user", async () => {
    mockedGetActor.mockResolvedValue(actorFor(await createUser()));
    await createSkill("Crochet");
    await createSkill("Hidden thing", { status: "HIDDEN" });

    const response = await skillsRoute.GET(get("/api/skills?limit=10"), noParams);

    expect(response.status).toBe(200);
    const body = (await response.json()) as { items: { name: string }[] };
    expect(body.items.map((skill) => skill.name)).toEqual(["Crochet"]);
  });

  it("creates a custom interest with 201, then returns the same skill with 200", async () => {
    mockedGetActor.mockResolvedValue(actorFor(await createUser()));

    const first = await skillsRoute.POST(
      post("/api/skills", { name: "Pipe cleaner animals" }),
      noParams,
    );
    const second = await skillsRoute.POST(
      post("/api/skills", { name: " pipe cleaner ANIMALS " }),
      noParams,
    );

    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(await second.json()).toEqual(await first.json());
  });

  it("returns skill detail by slug and 404 for a hidden skill", async () => {
    mockedGetActor.mockResolvedValue(actorFor(await createUser()));
    await createSkill("Crochet");
    await createSkill("Hidden thing", { status: "HIDDEN" });

    const found = await skillDetailRoute.GET(get("/api/skills/crochet"), {
      params: Promise.resolve({ slug: "crochet" }),
    });
    const hidden = await skillDetailRoute.GET(get("/api/skills/hidden-thing"), {
      params: Promise.resolve({ slug: "hidden-thing" }),
    });

    expect(found.status).toBe(200);
    expect(await found.json()).toMatchObject({ name: "Crochet", slug: "crochet" });
    expect(hidden.status).toBe(404);
  });
});
