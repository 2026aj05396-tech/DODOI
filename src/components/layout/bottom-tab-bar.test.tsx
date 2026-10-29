import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { BottomTabBar } from "./bottom-tab-bar";

vi.mock("next/navigation", () => ({ usePathname: () => "/explore" }));

describe("BottomTabBar", () => {
  it("marks the current destination and keeps unbuilt ones as coming soon", () => {
    render(<BottomTabBar username="aanya-4821" />);

    expect(screen.getByRole("link", { name: "Explore" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Home" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Profile" })).toHaveAttribute("href", "/u/aanya-4821");
    // Create is live from P2-02.
    expect(screen.getByRole("link", { name: "Create" })).toHaveAttribute("href", "/create");
    expect(screen.getByRole("button", { name: /Community\s*, coming soon/ })).toBeInTheDocument();
  });
});
