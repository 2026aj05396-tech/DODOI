import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AISwitchState, AIUsageReport } from "@/lib/types/ai";

import { AiUsageDashboard } from "./ai-usage-dashboard";

const { getAiUsage, setAiSwitch } = vi.hoisted(() => ({
  getAiUsage: vi.fn(),
  setAiSwitch: vi.fn(),
}));
vi.mock("@/lib/api-client/admin", () => ({ getAiUsage, setAiSwitch }));

const REPORT: AIUsageReport = {
  from: "2026-10-29",
  to: "2026-10-30",
  totals: {
    requests: 40,
    inputTokens: 12_000,
    outputTokens: 3_400,
    costMicros: 25_000,
    errors: 4,
    blocked: 2,
  },
  byDay: [
    {
      date: "2026-10-29",
      requests: 15,
      inputTokens: 5_000,
      outputTokens: 1_400,
      costMicros: 10_000,
      errors: 1,
      blocked: 0,
    },
    {
      date: "2026-10-30",
      requests: 25,
      inputTokens: 7_000,
      outputTokens: 2_000,
      costMicros: 15_000,
      errors: 3,
      blocked: 2,
    },
  ],
  dailyCap: { used: 25, limit: 500 },
};
const ON: AISwitchState = { isOn: true, isConfigured: true, isSwitchedOff: false };

describe("AiUsageDashboard", () => {
  beforeEach(() => {
    getAiUsage.mockReset();
    setAiSwitch.mockReset();
  });

  it("shows totals, error rate, estimated cost, the cap and one row per day, newest first", () => {
    render(<AiUsageDashboard initialReport={REPORT} initialSwitch={ON} />);

    expect(screen.getByText("Requests", { selector: "dt" }).nextSibling).toHaveTextContent("40");
    expect(screen.getByText("10.0%")).toBeInTheDocument();
    expect(screen.getByText("$0.0250")).toBeInTheDocument();
    expect(screen.getByText("25 of 500 requests used (UTC day).")).toBeInTheDocument();
    const rows = within(screen.getByRole("table")).getAllByRole("row").slice(1);
    expect(rows[0]).toHaveTextContent("2026-10-30");
    expect(rows[1]).toHaveTextContent("2026-10-29");
  });

  it("warns when the daily cap is reached", () => {
    render(
      <AiUsageDashboard
        initialReport={{ ...REPORT, dailyCap: { used: 500, limit: 500 } }}
        initialSwitch={ON}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("The daily cap is reached");
  });

  it("switches the companion off and on, and says so", async () => {
    setAiSwitch.mockResolvedValueOnce({ isOn: false, isConfigured: true, isSwitchedOff: true });
    setAiSwitch.mockResolvedValueOnce(ON);
    render(<AiUsageDashboard initialReport={REPORT} initialSwitch={ON} />);

    await userEvent.click(screen.getByRole("button", { name: "Switch off" }));
    expect(setAiSwitch).toHaveBeenLastCalledWith(false);
    expect(await screen.findByRole("button", { name: "Switch on" })).toBeInTheDocument();
    expect(screen.getByText("Off")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Switch on" }));
    expect(setAiSwitch).toHaveBeenLastCalledWith(true);
    expect(await screen.findByRole("button", { name: "Switch off" })).toBeInTheDocument();
  });

  it("cannot be switched on when the server isn't set up for the companion", () => {
    render(
      <AiUsageDashboard
        initialReport={REPORT}
        initialSwitch={{ isOn: false, isConfigured: false, isSwitchedOff: false }}
      />,
    );

    expect(screen.getByRole("button", { name: "Switch off" })).toBeDisabled();
    expect(screen.getByText(/can't turn it on/)).toBeInTheDocument();
  });

  it("loads another range", async () => {
    getAiUsage.mockResolvedValue({ ...REPORT, totals: { ...REPORT.totals, requests: 99 } });
    render(<AiUsageDashboard initialReport={REPORT} initialSwitch={ON} />);

    await userEvent.click(screen.getByRole("button", { name: "7 days" }));

    await waitFor(() => expect(screen.getByText("99")).toBeInTheDocument());
    expect(getAiUsage).toHaveBeenCalledWith({
      from: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      to: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    });
  });
});
