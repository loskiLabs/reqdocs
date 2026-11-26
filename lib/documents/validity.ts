export type DocumentStatus =
  | "current"
  | "expiring_soon"
  | "expired"
  | "no_expiry";

export type ExpiryMethod = "duration" | "fixed_date" | "none";

export type DocumentStatusResult = {
  remainingDays: number | null;
  status: DocumentStatus;
};

type DateParts = {
  day: number;
  month: number;
  year: number;
};

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseDateOnly(value: string): DateParts {
  const match = DATE_ONLY_PATTERN.exec(value);

  if (!match) {
    throw new Error("Expected a date in YYYY-MM-DD format.");
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const candidate = new Date(Date.UTC(year, month - 1, day));

  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    throw new Error("Expected a real calendar date.");
  }

  return { day, month, year };
}

function toEpochDay(value: string): number {
  const { day, month, year } = parseDateOnly(value);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

function formatDateOnly({ day, month, year }: DateParts): string {
  return `${year.toString().padStart(4, "0")}-${month
    .toString()
    .padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
}

export function isDateOnly(value: string): boolean {
  try {
    parseDateOnly(value);
    return true;
  } catch {
    return false;
  }
}

export function calculateExpiryDate(
  validFrom: string,
  durationMonths: number,
): string {
  const source = parseDateOnly(validFrom);

  if (!Number.isInteger(durationMonths) || durationMonths <= 0) {
    throw new Error("Duration months must be a positive whole number.");
  }

  const targetMonthIndex = source.month - 1 + durationMonths;
  const targetYear = source.year + Math.floor(targetMonthIndex / 12);
  const targetMonthIndexInYear = targetMonthIndex % 12;
  const lastDayOfTargetMonth = new Date(
    Date.UTC(targetYear, targetMonthIndexInYear + 1, 0),
  ).getUTCDate();

  return formatDateOnly({
    day: Math.min(source.day, lastDayOfTargetMonth),
    month: targetMonthIndexInYear + 1,
    year: targetYear,
  });
}

export function calculateDocumentStatus(
  expiresOn: string | null,
  warningDays: number,
  today: string,
): DocumentStatusResult {
  if (!Number.isInteger(warningDays) || warningDays < 0) {
    throw new Error("Warning days must be a non-negative whole number.");
  }

  if (expiresOn === null) {
    parseDateOnly(today);
    return { remainingDays: null, status: "no_expiry" };
  }

  const remainingDays = toEpochDay(expiresOn) - toEpochDay(today);

  if (remainingDays < 0) {
    return { remainingDays, status: "expired" };
  }

  if (remainingDays <= warningDays) {
    return { remainingDays, status: "expiring_soon" };
  }

  return { remainingDays, status: "current" };
}

export function getJohannesburgToday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Africa/Johannesburg",
    year: "numeric",
  }).formatToParts(now);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return `${values.year}-${values.month}-${values.day}`;
}

export function getStatusLabel(status: DocumentStatus): string {
  const labels: Record<DocumentStatus, string> = {
    current: "Current",
    expired: "Expired",
    expiring_soon: "Expiring soon",
    no_expiry: "No expiry recorded",
  };

  return labels[status];
}

export function getRemainingDaysMessage(
  result: DocumentStatusResult,
): string {
  if (result.remainingDays === null) {
    return "This document has no known expiry date.";
  }

  if (result.remainingDays < 0) {
    const elapsed = Math.abs(result.remainingDays);
    return `Expired ${elapsed} day${elapsed === 1 ? "" : "s"} ago.`;
  }

  if (result.remainingDays === 0) {
    return "Expires at the end of today.";
  }

  return `${result.remainingDays} day${result.remainingDays === 1 ? "" : "s"} remaining.`;
}
