import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useVoiceTyping } from "@/hooks/use-voice-typing";

import { VoiceInputButton, VoiceInputStatus } from "./voice-input";
import {
  FakeSpeechRecognition,
  installFakeSpeech,
  removeFakeSpeech,
} from "../../../tests/helpers/fake-speech";

function Box({ label = "Story", maxLength }: { label?: string; maxLength?: number }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState("");
  const [sent, setSent] = useState(false);
  const voice = useVoiceTyping({ inputRef: ref, value, onValueChange: setValue, maxLength });
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        setSent(true);
        setValue("");
      }}
    >
      <label htmlFor={label}>{label}</label>
      <textarea
        id={label}
        ref={ref}
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
      <VoiceInputButton voice={voice} />
      <VoiceInputStatus voice={voice} />
      <button type="submit">Send</button>
      {sent ? <p>sent</p> : null}
    </form>
  );
}

function setOnline(isOnline: boolean) {
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(isOnline);
  act(() => {
    window.dispatchEvent(new Event(isOnline ? "online" : "offline"));
  });
}

async function startListening(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Start voice typing" }));
  const note = screen.queryByRole("button", { name: "Continue" });
  if (note) await user.click(note);
}

beforeEach(() => {
  window.localStorage.clear();
  installFakeSpeech();
});

afterEach(() => {
  removeFakeSpeech();
  vi.restoreAllMocks();
});

describe("VoiceInputButton", () => {
  it("is not offered when the browser has no speech recognition", () => {
    removeFakeSpeech();
    render(<Box />);
    expect(screen.queryByRole("button", { name: /voice typing/i })).not.toBeInTheDocument();
  });

  it("asks once, before the first use on a device", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<Box />);
    await user.click(screen.getByRole("button", { name: "Start voice typing" }));

    expect(screen.getByText(/Google's speech service/)).toBeInTheDocument();
    expect(FakeSpeechRecognition.instances).toHaveLength(0);
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(FakeSpeechRecognition.last.isRunning).toBe(true);

    unmount();
    render(<Box />);
    await user.click(screen.getByRole("button", { name: "Start voice typing" }));
    expect(screen.queryByText(/Google's speech service/)).not.toBeInTheDocument();
    expect(FakeSpeechRecognition.instances).toHaveLength(2);
  });

  it("does not listen when the note is cancelled", async () => {
    const user = userEvent.setup();
    render(<Box />);
    await user.click(screen.getByRole("button", { name: "Start voice typing" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(FakeSpeechRecognition.instances).toHaveLength(0);
  });

  it("listens in English (India) and shows the stop state", async () => {
    const user = userEvent.setup();
    render(<Box />);
    await startListening(user);

    expect(FakeSpeechRecognition.last.lang).toBe("en-IN");
    expect(FakeSpeechRecognition.last.interimResults).toBe(true);
    const stop = screen.getByRole("button", { name: "Stop voice typing" });
    expect(stop).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Listening…")).toBeInTheDocument();

    await user.click(stop);
    expect(screen.getByRole("button", { name: "Start voice typing" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.queryByText("Listening…")).not.toBeInTheDocument();
  });

  it("shows what it hears and types only the final words, without sending", async () => {
    const user = userEvent.setup();
    render(<Box />);
    await startListening(user);

    act(() => FakeSpeechRecognition.last.hearInterim("I made a"));
    expect(screen.getByText("I made a")).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveValue("");

    act(() => FakeSpeechRecognition.last.hearFinal("I made a scarf"));
    expect(screen.getByRole("textbox")).toHaveValue("I made a scarf");
    expect(screen.queryByText("sent")).not.toBeInTheDocument();
  });

  it("puts the words at the caret and keeps the existing text", async () => {
    const user = userEvent.setup();
    render(<Box />);
    const field = screen.getByRole<HTMLTextAreaElement>("textbox");
    await user.type(field, "red scarf");
    field.setSelectionRange(3, 3);
    await startListening(user);

    act(() => FakeSpeechRecognition.last.hearFinal("wool"));
    expect(field).toHaveValue("red wool scarf");
  });

  it("respects the box's length limit", async () => {
    const user = userEvent.setup();
    render(<Box maxLength={12} />);
    await startListening(user);
    act(() => FakeSpeechRecognition.last.hearFinal("a very long sentence indeed"));
    expect(screen.getByRole("textbox")).toHaveValue("a very long ");
  });

  it("explains a blocked microphone and keeps typing possible", async () => {
    const user = userEvent.setup();
    render(<Box />);
    await startListening(user);
    act(() => {
      FakeSpeechRecognition.last.fail("not-allowed");
      FakeSpeechRecognition.last.end();
    });

    expect(screen.getByText(/Microphone is blocked/)).toBeInTheDocument();
    await user.type(screen.getByRole("textbox"), "still typing");
    expect(screen.getByRole("textbox")).toHaveValue("still typing");
  });

  it.each([
    ["no-speech", /didn't hear anything/],
    ["network", /isn't working right now/],
    ["service-not-allowed", /isn't working right now/],
  ])("shows a friendly message for %s", async (error, message) => {
    const user = userEvent.setup();
    render(<Box />);
    await startListening(user);
    act(() => {
      FakeSpeechRecognition.last.fail(error);
      FakeSpeechRecognition.last.end();
    });
    expect(screen.getByText(message)).toBeInTheDocument();
  });

  it("is disabled with a reason while offline, and stops when the connection drops", async () => {
    const user = userEvent.setup();
    render(<Box />);
    await startListening(user);
    expect(FakeSpeechRecognition.last.isRunning).toBe(true);

    setOnline(false);
    expect(FakeSpeechRecognition.last.isRunning).toBe(false);
    expect(screen.getByRole("button", { name: "Voice typing needs a connection" })).toBeDisabled();
  });

  it("stops when the page is hidden", async () => {
    const user = userEvent.setup();
    render(<Box />);
    await startListening(user);

    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(FakeSpeechRecognition.last.isRunning).toBe(false);
  });

  it("stops when the box loses focus to something else, but not for the mic button", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Box />
        <input aria-label="Other" />
      </>,
    );
    await user.click(screen.getByRole("textbox", { name: "Story" }));
    await startListening(user);
    expect(FakeSpeechRecognition.last.isRunning).toBe(true);

    await user.click(screen.getByRole("textbox", { name: "Other" }));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
    expect(FakeSpeechRecognition.last.isRunning).toBe(false);
  });

  it("stops when the text is sent and the box empties", async () => {
    const user = userEvent.setup();
    render(<Box />);
    await startListening(user);
    act(() => FakeSpeechRecognition.last.hearFinal("hello"));
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(screen.getByText("sent")).toBeInTheDocument();
    expect(FakeSpeechRecognition.last.isRunning).toBe(false);
  });

  it("lets only one box listen at a time", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Box label="First" />
        <Box label="Second" />
      </>,
    );
    const [first, second] = screen.getAllByRole("button", { name: "Start voice typing" });
    if (!first || !second) throw new Error("Expected two voice buttons");
    await user.click(first);
    await user.click(screen.getByRole("button", { name: "Continue" }));
    const firstRecognition = FakeSpeechRecognition.last;

    await user.click(second);
    expect(firstRecognition.isRunning).toBe(false);
    expect(FakeSpeechRecognition.last).not.toBe(firstRecognition);
    expect(FakeSpeechRecognition.last.isRunning).toBe(true);
  });

  it("announces listening and stopped to screen readers", async () => {
    const user = userEvent.setup();
    render(<Box />);
    await startListening(user);
    expect(screen.getAllByRole("status").some((el) => el.textContent === "Listening")).toBe(true);

    await user.click(screen.getByRole("button", { name: "Stop voice typing" }));
    expect(screen.getAllByRole("status").some((el) => el.textContent === "Stopped")).toBe(true);
  });
});
