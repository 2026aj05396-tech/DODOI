import "server-only";

// Structured JSON logs to stdout (SYSTEM_ARCHITECTURE §11). Never log passwords, tokens,
// cookies, email addresses or private content — sensitive keys are redacted as a safety net.

type LogLevel = "debug" | "info" | "warn" | "error";
export type LogFields = Record<string, unknown>;

const REDACTED = "[redacted]";
const SENSITIVE_KEY_PATTERN =
  /pass(word)?|secret|token|authorization|cookie|session|email|dateOfBirth|dob|apiKey|signature/i;
const MAX_DEPTH = 5;

export function redact(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return "[truncated]";
  if (Array.isArray(value)) return value.map((entry) => redact(entry, depth + 1));
  if (value instanceof Error) return { name: value.name, message: value.message };
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        SENSITIVE_KEY_PATTERN.test(key) ? REDACTED : redact(entry, depth + 1),
      ]),
    );
  }
  return value;
}

function write(level: LogLevel, message: string, fields: LogFields = {}): void {
  const line = JSON.stringify({
    level,
    time: new Date().toISOString(),
    message,
    ...(redact(fields) as LogFields),
  });
  if (level === "error" || level === "warn") {
    process.stderr.write(`${line}\n`);
  } else {
    process.stdout.write(`${line}\n`);
  }
}

export const logger = {
  debug: (message: string, fields?: LogFields) => write("debug", message, fields),
  info: (message: string, fields?: LogFields) => write("info", message, fields),
  warn: (message: string, fields?: LogFields) => write("warn", message, fields),
  error: (message: string, fields?: LogFields) => write("error", message, fields),
};
