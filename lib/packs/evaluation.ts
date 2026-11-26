import { calculateExpiryDate } from "../documents/validity";

export type RequirementResult =
  | "current"
  | "expiring_soon"
  | "expired"
  | "missing"
  | "wrong_year"
  | "unsigned"
  | "no_expiry";

export type PackStatus =
  | "draft"
  | "ready"
  | "code_active"
  | "viewed"
  | "documents_received"
  | "needs_changes"
  | "cancelled";

export type EvaluationDocument = {
  createdAt: string;
  expiresOn: string | null;
  id: string;
  referenceYear: number | null;
  signedAttested: boolean;
  validFrom: string;
};

export type EvaluationRequirement = {
  allowsNoExpiry: boolean;
  freshnessMonths: number | null;
  requiredReferenceYear: number | null;
  requiresSignedAttestation: boolean;
};

export type RequirementEvaluation = {
  documentId: string | null;
  effectiveExpiresOn: string | null;
  reason: string;
  result: RequirementResult;
  satisfied: boolean;
};

function earliestDate(first: string | null, second: string | null) {
  if (!first) return second;
  if (!second) return first;
  return first < second ? first : second;
}

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function evaluateDocumentAgainstRequirement(
  document: EvaluationDocument | null,
  requirement: EvaluationRequirement,
  today: string,
): RequirementEvaluation {
  if (!document) {
    return {
      documentId: null,
      effectiveExpiresOn: null,
      reason: "Upload this required document.",
      result: "missing",
      satisfied: false,
    };
  }

  if (
    requirement.requiredReferenceYear !== null &&
    document.referenceYear !== requirement.requiredReferenceYear
  ) {
    return {
      documentId: document.id,
      effectiveExpiresOn: null,
      reason: `A ${requirement.requiredReferenceYear} document is required.`,
      result: "wrong_year",
      satisfied: false,
    };
  }

  if (requirement.requiresSignedAttestation && !document.signedAttested) {
    return {
      documentId: document.id,
      effectiveExpiresOn: null,
      reason: "Confirm that the form is completed and signed.",
      result: "unsigned",
      satisfied: false,
    };
  }

  const freshnessLimit = requirement.freshnessMonths
    ? calculateExpiryDate(document.validFrom, requirement.freshnessMonths)
    : null;
  const effectiveExpiresOn = earliestDate(document.expiresOn, freshnessLimit);

  if (!effectiveExpiresOn) {
    return requirement.allowsNoExpiry
      ? {
          documentId: document.id,
          effectiveExpiresOn: null,
          reason: "Current according to the dates provided; no expiry is recorded.",
          result: "no_expiry",
          satisfied: true,
        }
      : {
          documentId: document.id,
          effectiveExpiresOn: null,
          reason: "An expiry date is required for this service.",
          result: "expired",
          satisfied: false,
        };
  }

  if (effectiveExpiresOn < today) {
    return {
      documentId: document.id,
      effectiveExpiresOn,
      reason: `Expired on ${effectiveExpiresOn}.`,
      result: "expired",
      satisfied: false,
    };
  }

  if (effectiveExpiresOn <= addDays(today, 21)) {
    return {
      documentId: document.id,
      effectiveExpiresOn,
      reason: `Current, but reaches its service limit on ${effectiveExpiresOn}.`,
      result: "expiring_soon",
      satisfied: true,
    };
  }

  return {
    documentId: document.id,
    effectiveExpiresOn,
    reason: `Current according to the dates provided until ${effectiveExpiresOn}.`,
    result: "current",
    satisfied: true,
  };
}

export function selectBestDocument(
  documents: EvaluationDocument[],
  requirement: EvaluationRequirement,
  today: string,
): RequirementEvaluation {
  const candidates = [...documents]
    .sort(
      (a, b) =>
        b.validFrom.localeCompare(a.validFrom) ||
        b.createdAt.localeCompare(a.createdAt),
    )
    .map((document) =>
      evaluateDocumentAgainstRequirement(document, requirement, today),
    );

  return (
    candidates.find((candidate) => candidate.satisfied) ??
    candidates[0] ??
    evaluateDocumentAgainstRequirement(null, requirement, today)
  );
}

export function calculatePackReadiness(
  items: Array<{ satisfied: boolean }>,
): number {
  if (items.length === 0) return 0;
  return Math.round(
    (items.filter((item) => item.satisfied).length / items.length) * 100,
  );
}

export function calculateNextAction(pack: {
  readinessPercent: number;
  status: PackStatus;
}): string {
  if (pack.status === "cancelled") return "This Service Pack was cancelled.";
  if (pack.status === "documents_received") {
    return "Documents received for processing. Follow up with the service provider if needed.";
  }
  if (pack.status === "viewed") {
    return "Staff access is active. Wait for an outcome or cancel access when it is no longer needed.";
  }
  if (pack.status === "code_active") {
    return "Give the six-digit code to staff before it expires.";
  }
  if (pack.status === "needs_changes") {
    return "Replace the documents identified by staff, then review the pack again.";
  }
  if (pack.readinessPercent === 100) {
    return "Review the exact document list, then generate a staff access code.";
  }
  return "Upload or replace the incomplete documents shown below.";
}
