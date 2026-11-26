import { describe, expect, it } from "vitest";
import {
  calculateNextAction,
  calculatePackReadiness,
  evaluateDocumentAgainstRequirement,
  selectBestDocument,
  type EvaluationDocument,
} from "./evaluation";

const baseDocument: EvaluationDocument = {
  createdAt: "2026-08-01T10:00:00Z",
  expiresOn: "2026-12-31",
  id: "one",
  referenceYear: 2026,
  signedAttested: true,
  validFrom: "2026-08-01",
};

const baseRequirement = {
  allowsNoExpiry: false,
  freshnessMonths: null,
  requiredReferenceYear: null,
  requiresSignedAttestation: false,
};

describe("service requirement evaluation", () => {
  it("reports missing, wrong-year, unsigned and expired documents", () => {
    expect(evaluateDocumentAgainstRequirement(null, baseRequirement, "2026-08-22").result).toBe("missing");
    expect(evaluateDocumentAgainstRequirement(baseDocument, { ...baseRequirement, requiredReferenceYear: 2025 }, "2026-08-22").result).toBe("wrong_year");
    expect(evaluateDocumentAgainstRequirement({ ...baseDocument, signedAttested: false }, { ...baseRequirement, requiresSignedAttestation: true }, "2026-08-22").result).toBe("unsigned");
    expect(evaluateDocumentAgainstRequirement({ ...baseDocument, expiresOn: "2026-08-21" }, baseRequirement, "2026-08-22").result).toBe("expired");
  });

  it("treats the 21-day boundary as satisfied but expiring soon", () => {
    const result = evaluateDocumentAgainstRequirement(
      { ...baseDocument, expiresOn: "2026-09-12" },
      baseRequirement,
      "2026-08-22",
    );
    expect(result).toMatchObject({ result: "expiring_soon", satisfied: true });
  });

  it("uses the earlier calendar-month freshness limit", () => {
    const result = evaluateDocumentAgainstRequirement(
      { ...baseDocument, expiresOn: "2027-01-01", validFrom: "2026-05-31" },
      { ...baseRequirement, freshnessMonths: 3 },
      "2026-08-22",
    );
    expect(result.effectiveExpiresOn).toBe("2026-08-31");
  });

  it("selects the newest satisfying document before a newer failure", () => {
    const selected = selectBestDocument(
      [
        { ...baseDocument, id: "valid", validFrom: "2026-07-01" },
        { ...baseDocument, id: "newer-wrong", referenceYear: 2025, validFrom: "2026-08-01" },
      ],
      { ...baseRequirement, requiredReferenceYear: 2026 },
      "2026-08-22",
    );
    expect(selected.documentId).toBe("valid");
  });
});

describe("pack summaries", () => {
  it.each([
    [4, 5, 80],
    [2, 3, 67],
    [3, 3, 100],
  ])("calculates %s/%s as %s%%", (satisfied, total, expected) => {
    expect(calculatePackReadiness(Array.from({ length: total }, (_, index) => ({ satisfied: index < satisfied })))).toBe(expected);
  });

  it("provides an explicit next action", () => {
    expect(calculateNextAction({ readinessPercent: 100, status: "ready" })).toContain("generate");
    expect(calculateNextAction({ readinessPercent: 40, status: "draft" })).toContain("Upload");
  });
});
