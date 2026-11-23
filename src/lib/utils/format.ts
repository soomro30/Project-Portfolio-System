import { format, isValid, parseISO } from "date-fns";

export function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function titleCase(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function slugifyName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/(^\.|\.$)/g, "");
}

export function toDateOnly(value: Date | string | number | null | undefined) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString().slice(0, 10);
}

export function formatDisplayDate(value: Date | string | number | null | undefined) {
  if (!value) {
    return null;
  }

  const date =
    typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? parseISO(value)
      : new Date(value);

  if (!isValid(date)) {
    return null;
  }

  return format(date, "do MMMM yyyy");
}

export function formatCompactDate(value: Date | string | number | null | undefined) {
  if (!value) {
    return null;
  }

  const date =
    typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? parseISO(value)
      : new Date(value);

  if (!isValid(date)) {
    return null;
  }

  return format(date, "d MMM yyyy");
}

export function deriveProgressPercent(
  explicitProgressPercent?: number | string | null,
  stage?: string | null,
) {
  if (explicitProgressPercent !== "" && explicitProgressPercent != null) {
    const parsed = Number(explicitProgressPercent);

    if (Number.isFinite(parsed)) {
      return Math.max(0, Math.min(100, parsed));
    }
  }

  const normalizedStage = stage?.trim().toLowerCase();
  if (normalizedStage === "completed") return 100;
  if (normalizedStage === "not started") return 0;

  return null;
}

export function isMeaningfulText(value?: string | null) {
  if (!value) {
    return false;
  }

  return !["none", "n/a", "na", "-"].includes(value.trim().toLowerCase());
}
