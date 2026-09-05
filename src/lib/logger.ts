/**
 * Structured logging (spec §28 "Structured logging, error tracking").
 *
 * No external APM/error-tracking service (Sentry, Datadog, ...) is
 * configured anywhere in this app — same honesty rule as messaging/payment
 * providers: rather than faking a dashboard, this emits real single-line
 * JSON to stdout/stderr, which is exactly what every log aggregator (a
 * platform's own log viewer, Datadog, CloudWatch, etc.) expects to scrape.
 * Wiring a real error-tracking SDK later just means swapping `logError`'s
 * body — call sites don't change.
 */

type LogLevel = "info" | "warn" | "error";

type LogFields = Record<string, unknown>;

function emit(level: LogLevel, message: string, fields?: LogFields) {
  const line = JSON.stringify({
    level,
    message,
    time: new Date().toISOString(),
    ...fields,
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export function logInfo(message: string, fields?: LogFields): void {
  emit("info", message, fields);
}

export function logWarn(message: string, fields?: LogFields): void {
  emit("warn", message, fields);
}

export function logError(message: string, error: unknown, fields?: LogFields): void {
  emit("error", message, {
    ...fields,
    error:
      error instanceof Error
        ? { name: error.name, message: error.message, stack: error.stack }
        : error,
  });
}
