import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SearchField } from "./search-field";

describe("SearchField", () => {
  it("gives the input an accessible name even though the label is not visible", () => {
    render(<SearchField label="Search skills" placeholder="Skills, projects, makers" />);

    expect(screen.getByRole("searchbox", { name: "Search skills" })).toBeInTheDocument();
  });
});
