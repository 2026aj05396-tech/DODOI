import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FieldError } from "./field-error";

describe("FieldError", () => {
  it("is read together with the field it describes", () => {
    render(
      <>
        <input aria-label="Email" aria-describedby="email-error" aria-invalid />
        <FieldError id="email-error">Add the part after the @</FieldError>
      </>,
    );

    expect(screen.getByRole("textbox", { name: "Email" })).toHaveAccessibleDescription(
      "Add the part after the @",
    );
  });

  it("renders nothing when there is no message", () => {
    const { container } = render(<FieldError id="name-error" />);

    expect(container).toBeEmptyDOMElement();
  });
});
