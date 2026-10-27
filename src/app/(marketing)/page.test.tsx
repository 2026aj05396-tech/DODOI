import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import WelcomePage from "./page";

describe("WelcomePage", () => {
  // Both layouts are in the DOM (CSS hides one per width; jsdom applies no CSS).
  it("renders the mobile Welcome (1a) and the web Landing (2a) with the same ways in", () => {
    render(<WelcomePage />);

    expect(
      screen.getAllByRole("heading", {
        level: 1,
        name: "For the things you love making, and all the things you haven't tried yet.",
      }),
    ).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Continue with Google" })).toHaveLength(2);
    for (const link of screen.getAllByRole("link", { name: "Sign up with email" })) {
      expect(link).toHaveAttribute("href", "/sign-up");
    }
    for (const link of screen.getAllByRole("link", { name: "Log in" })) {
      expect(link).toHaveAttribute("href", "/sign-in");
    }
    expect(screen.getByRole("link", { name: "Join free" })).toHaveAttribute("href", "/sign-up");
  });

  it("links the product areas that have shipped and leaves the others as labels", () => {
    render(<WelcomePage />);

    const areas = screen.getByRole("list", { name: "What you can do on dodoi" });
    expect(within(areas).getByRole("link", { name: "Discover" })).toHaveAttribute(
      "href",
      "/explore",
    );
    expect(within(areas).getAllByRole("link")).toHaveLength(1);
    expect(within(areas).getByText("Companion")).toBeVisible();
  });
});
