const SENSITIVE_ENV_KEY = /(?:token|api[_-]?key|secret|password|passwd|authorization|cookie|private[_-]?key|client[_-]?secret|credential)/i;

function sensitiveValues(): string[] {
  return [...new Set(
    Object.entries(process.env)
      .filter(([key, value]) => SENSITIVE_ENV_KEY.test(key) && typeof value === "string" && value.length >= 8)
      .map(([, value]) => value as string),
  )].sort((left, right) => right.length - left.length);
}

export function redactSensitiveText(value: string): string {
  let redacted = value;
  for (const secret of sensitiveValues()) redacted = redacted.split(secret).join("[redacted]");
  return redacted;
}
