"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ErrorBanner } from "@/components/ui/error-banner";
import { showToast } from "@/components/ui/toast";
import { getAiUsage, setAiSwitch } from "@/lib/api-client/admin";
import { ApiRequestError } from "@/lib/api-client/request";
import type { AISwitchState, AIUsageReport } from "@/lib/types/ai";
import { cn } from "@/lib/utils/cn";

// Admin → AI (P4-05, AIC-10): the companion's kill switch, today's use of the global cap, and
// usage per day. Numbers only: no question, answer or photo is ever shown here.

const RANGES = [7, 30, 90] as const;
const DAY_MS = 24 * 60 * 60 * 1000;

const NUMBER = new Intl.NumberFormat("en-US");

function dollars(costMicros: number): string {
  return `$${(costMicros / 1_000_000).toFixed(4)}`;
}

function percent(part: number, whole: number): string {
  return whole === 0 ? "–" : `${((part / whole) * 100).toFixed(1)}%`;
}

function rangeEndingToday(days: number): { from: string; to: string } {
  const to = new Date();
  const toDay = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()));
  return {
    from: new Date(toDay.getTime() - (days - 1) * DAY_MS).toISOString().slice(0, 10),
    to: toDay.toISOString().slice(0, 10),
  };
}

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-card border border-border bg-background p-4">
      <dt className="text-meta text-foreground-secondary">{label}</dt>
      <dd className="text-greeting text-foreground">{value}</dd>
      {hint ? <p className="text-meta text-foreground-secondary">{hint}</p> : null}
    </div>
  );
}

export function AiUsageDashboard({
  initialReport,
  initialSwitch,
}: {
  initialReport: AIUsageReport;
  initialSwitch: AISwitchState;
}) {
  const [report, setReport] = useState(initialReport);
  const [days, setDays] = useState<number>(30);
  const [switchState, setSwitchState] = useState(initialSwitch);
  const [isSwitching, setIsSwitching] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function chooseRange(next: number) {
    setDays(next);
    setIsLoading(true);
    setError(null);
    try {
      setReport(await getAiUsage(rangeEndingToday(next)));
    } catch (caught) {
      setError(
        caught instanceof ApiRequestError ? caught.message : "We couldn't load the usage numbers.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function toggle() {
    setIsSwitching(true);
    try {
      const next = await setAiSwitch(switchState.isSwitchedOff);
      setSwitchState(next);
      showToast({
        message: next.isSwitchedOff ? "Companion switched off" : "Companion switched on",
      });
    } catch (caught) {
      showToast({
        message: caught instanceof ApiRequestError ? caught.message : "We couldn't change that.",
      });
    } finally {
      setIsSwitching(false);
    }
  }

  const { totals, dailyCap } = report;
  const isCapReached = dailyCap.used >= dailyCap.limit;

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-greeting text-foreground md:text-greeting-web">AI companion</h1>

      <section
        aria-labelledby="ai-switch"
        className="flex flex-col gap-3 rounded-card border border-border bg-background p-5"
      >
        <div className="flex flex-wrap items-center gap-3">
          <h2 id="ai-switch" className="text-section text-foreground">
            Kill switch
          </h2>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-meta font-bold text-foreground">
            <span
              aria-hidden
              className={cn(
                "size-2 rounded-full",
                switchState.isOn ? "bg-success" : "bg-muted-foreground",
              )}
            />
            {switchState.isOn ? "On" : "Off"}
          </span>
        </div>
        <p className="max-w-2xl text-body text-foreground-secondary">
          {switchState.isConfigured
            ? switchState.isSwitchedOff
              ? "The companion was switched off here. Members see “The companion is resting.” until you switch it on."
              : "Members can use the companion. Switching it off stops messages and plans at once."
            : "The companion is off because AI_ENABLED, the key or the model is not set on the server. This switch can't turn it on."}
        </p>
        <Button
          variant={switchState.isSwitchedOff ? "primary" : "destructive"}
          disabled={isSwitching || !switchState.isConfigured}
          onClick={() => void toggle()}
          className="self-start"
        >
          {switchState.isSwitchedOff ? "Switch on" : "Switch off"}
        </Button>
      </section>

      <section aria-labelledby="ai-cap" className="flex flex-col gap-2">
        <h2 id="ai-cap" className="text-section text-foreground">
          Today&apos;s cap
        </h2>
        <p className="text-body text-foreground">
          {NUMBER.format(dailyCap.used)} of {NUMBER.format(dailyCap.limit)} requests used (UTC day).
        </p>
        {isCapReached ? (
          <ErrorBanner role="status">
            The daily cap is reached. The companion rests for everyone until tomorrow (UTC).
          </ErrorBanner>
        ) : null}
      </section>

      <section aria-labelledby="ai-usage" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="ai-usage" className="text-section text-foreground">
            Usage, {report.from} to {report.to}
          </h2>
          <div role="group" aria-label="Range" className="flex gap-1.5">
            {RANGES.map((range) => (
              <button
                key={range}
                type="button"
                aria-pressed={days === range}
                disabled={isLoading}
                onClick={() => void chooseRange(range)}
                className={cn(
                  "min-h-11 rounded-full border px-4 text-control",
                  days === range
                    ? "border-foreground bg-inverse font-bold text-inverse-foreground"
                    : "border-border-strong text-foreground hover:bg-muted",
                )}
              >
                {range} days
              </button>
            ))}
          </div>
        </div>
        {error ? <ErrorBanner>{error}</ErrorBanner> : null}
        <dl className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <Tile label="Requests" value={NUMBER.format(totals.requests)} />
          <Tile label="Input tokens" value={NUMBER.format(totals.inputTokens)} />
          <Tile label="Output tokens" value={NUMBER.format(totals.outputTokens)} />
          <Tile
            label="Estimated cost"
            value={dollars(totals.costMicros)}
            hint="From the token prices in the server settings; 0 on the free tier."
          />
          <Tile
            label="Error rate"
            value={percent(totals.errors, totals.requests)}
            hint={`${NUMBER.format(totals.errors)} failed`}
          />
          <Tile
            label="Blocked"
            value={NUMBER.format(totals.blocked)}
            hint="Stopped by safety filters"
          />
        </dl>

        <div className="overflow-x-auto rounded-card border border-border bg-background">
          <table className="w-full min-w-[34rem] text-left text-body">
            <caption className="sr-only">Usage per day, newest first</caption>
            <thead className="text-meta text-foreground-secondary">
              <tr>
                <th scope="col" className="px-4 py-3 font-bold">
                  Day
                </th>
                <th scope="col" className="px-4 py-3 text-right font-bold">
                  Requests
                </th>
                <th scope="col" className="px-4 py-3 text-right font-bold">
                  Tokens in / out
                </th>
                <th scope="col" className="px-4 py-3 text-right font-bold">
                  Cost
                </th>
                <th scope="col" className="px-4 py-3 text-right font-bold">
                  Errors
                </th>
                <th scope="col" className="px-4 py-3 text-right font-bold">
                  Blocked
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {[...report.byDay].reverse().map((day) => (
                <tr
                  key={day.date}
                  className={day.requests === 0 ? "text-foreground-secondary" : ""}
                >
                  <th scope="row" className="px-4 py-2.5 font-normal">
                    {day.date}
                  </th>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {NUMBER.format(day.requests)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {NUMBER.format(day.inputTokens)} / {NUMBER.format(day.outputTokens)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{dollars(day.costMicros)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {NUMBER.format(day.errors)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {NUMBER.format(day.blocked)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
