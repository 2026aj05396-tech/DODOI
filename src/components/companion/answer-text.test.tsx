import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AnswerText } from "./answer-text";

const SKILLS = [
  { name: "Crochet", slug: "crochet" },
  { name: "Pottery Wheel", slug: "pottery-wheel" },
  { name: "Pottery", slug: "pottery" },
];

describe("AnswerText", () => {
  it("turns exact skill names into links, longest name first", () => {
    render(<AnswerText text="Try Crochet, then the Pottery Wheel or Pottery." skills={SKILLS} />);

    expect(screen.getByRole("link", { name: "Crochet" })).toHaveAttribute("href", "/s/crochet");
    expect(screen.getByRole("link", { name: "Pottery Wheel" })).toHaveAttribute(
      "href",
      "/s/pottery-wheel",
    );
    expect(screen.getByRole("link", { name: "Pottery" })).toHaveAttribute("href", "/s/pottery");
  });

  it("does not link a name that is only part of a longer word", () => {
    render(<AnswerText text="Crocheting is relaxing." skills={SKILLS} />);

    expect(screen.queryByRole("link")).toBeNull();
  });

  it("shows numbered steps, bullets and bold text", () => {
    render(
      <AnswerText
        text={"Do this:\n1. Count the stitches.\n2. **Compare** with the pattern.\n\n- Keep notes"}
        skills={[]}
      />,
    );

    expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "Count the stitches.",
      "Compare with the pattern.",
      "Keep notes",
    ]);
    expect(screen.getByText("Compare").tagName).toBe("STRONG");
  });

  it("never turns the model's text into markup", () => {
    const { container } = render(
      <AnswerText text={'<img src=x onerror="alert(1)"> <script>alert(1)</script>'} skills={[]} />,
    );

    expect(container.querySelector("img, script")).toBeNull();
    expect(container.textContent).toContain("<script>alert(1)</script>");
  });
});
