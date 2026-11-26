import { describe, expect, it } from "vitest";
import {
  calculateDocumentStatus,
  calculateExpiryDate,
  getJohannesburgToday,
} from "./validity";

describe("calculateExpiryDate", () => {
  it("adds calendar months instead of a fixed number of days", () => {
    expect(calculateExpiryDate("2026-01-15", 3)).toBe("2026-04-15");
  });

  it("clamps end-of-month dates to the last real day", () => {
    expect(calculateExpiryDate("2026-01-31", 1)).toBe("2026-02-28");
    expect(calculateExpiryDate("2028-01-31", 1)).toBe("2028-02-29");
  });

  it("crosses a year boundary", () => {
    expect(calculateExpiryDate("2026-11-30", 3)).toBe("2027-02-28");
  });
});

describe("calculateDocumentStatus", () => {
  const today = "2026-08-22";

  it("marks more than 21 days as current", () => {
    expect(calculateDocumentStatus("2026-09-13", 21, today)).toEqual({
      remainingDays: 22,
      status: "current",
    });
  });

  it("includes exactly 21 days and one day in expiring soon", () => {
    expect(calculateDocumentStatus("2026-09-12", 21, today).status).toBe(
      "expiring_soon",
    );
    expect(calculateDocumentStatus("2026-08-23", 21, today).status).toBe(
      "expiring_soon",
    );
  });

  it("keeps the document valid throughout its expiry date", () => {
    expect(calculateDocumentStatus(today, 21, today)).toEqual({
      remainingDays: 0,
      status: "expiring_soon",
    });
  });

  it("marks the day after expiry as expired", () => {
    expect(calculateDocumentStatus("2026-08-21", 21, today)).toEqual({
      remainingDays: -1,
      status: "expired",
    });
  });

  it("represents a document without an expiry separately", () => {
    expect(calculateDocumentStatus(null, 21, today)).toEqual({
      remainingDays: null,
      status: "no_expiry",
    });
  });
});

describe("getJohannesburgToday", () => {
  it("uses the Johannesburg calendar day across UTC midnight", () => {
    expect(getJohannesburgToday(new Date("2026-08-21T22:30:00Z"))).toBe(
      "2026-08-22",
    );
  });
});
