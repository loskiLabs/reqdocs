import { describe, expect, it } from "vitest";
import {
  MAX_DOCUMENT_SIZE_BYTES,
  sanitizeDisplayFilename,
  validateDocumentMetadata,
  validateFileBytes,
  validateUploadFile,
  type DocumentTypeRules,
} from "./upload-validation";

const certifiedId: DocumentTypeRules = {
  allowsSignedAttestation: false,
  defaultDurationMonths: 3,
  defaultExpiryMethod: "duration",
  id: "certified_id_copy",
  label: "Recent certified ID copy",
  requiresYear: false,
};

function validFields(overrides: Record<string, string> = {}) {
  return {
    description: "",
    displayName: "Certified ID",
    documentTypeId: certifiedId.id,
    durationMonths: "3",
    expiresOn: "",
    expiryMethod: "duration",
    issuer: "",
    referenceYear: "",
    signedAttested: "false",
    validFrom: "2026-08-01",
    ...overrides,
  };
}

describe("validateDocumentMetadata", () => {
  it("calculates duration expiry using calendar months", () => {
    const result = validateDocumentMetadata(
      validFields(),
      certifiedId,
      "2026-08-22",
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.expiresOn).toBe("2026-11-01");
      expect(result.data.durationMonths).toBe(3);
    }
  });

  it("rejects future valid-from dates", () => {
    const result = validateDocumentMetadata(
      validFields({ validFrom: "2026-08-23" }),
      certifiedId,
      "2026-08-22",
    );

    expect(result).toMatchObject({
      fieldErrors: { validFrom: expect.stringContaining("future") },
      success: false,
    });
  });

  it("allows no-expiry only for identity documents", () => {
    const invalid = validateDocumentMetadata(
      validFields({ durationMonths: "", expiryMethod: "none" }),
      certifiedId,
      "2026-08-22",
    );
    const identity = validateDocumentMetadata(
      validFields({
        documentTypeId: "identity_document",
        durationMonths: "",
        expiryMethod: "none",
      }),
      { ...certifiedId, id: "identity_document" },
      "2026-08-22",
    );

    expect(invalid.success).toBe(false);
    expect(identity.success).toBe(true);
  });

  it("uses and validates a fixed expiry date", () => {
    const valid = validateDocumentMetadata(
      validFields({
        durationMonths: "",
        expiresOn: "2030-08-01",
        expiryMethod: "fixed_date",
      }),
      certifiedId,
      "2026-08-22",
    );
    const backwards = validateDocumentMetadata(
      validFields({
        durationMonths: "",
        expiresOn: "2026-07-31",
        expiryMethod: "fixed_date",
      }),
      certifiedId,
      "2026-08-22",
    );

    expect(valid).toMatchObject({
      data: { durationMonths: null, expiresOn: "2030-08-01" },
      success: true,
    });
    expect(backwards).toMatchObject({
      fieldErrors: { expiresOn: expect.stringContaining("before") },
      success: false,
    });
  });
});

describe("file validation", () => {
  it("accepts matching PDF, JPEG and PNG signatures", () => {
    expect(
      validateFileBytes("application/pdf", new TextEncoder().encode("%PDF-1.7"))
        .success,
    ).toBe(true);
    expect(
      validateFileBytes("image/jpeg", new Uint8Array([0xff, 0xd8, 0xff])).success,
    ).toBe(true);
    expect(
      validateFileBytes(
        "image/png",
        new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      ).success,
    ).toBe(true);
  });

  it("rejects mismatched contents and path-like names", () => {
    expect(
      validateFileBytes("application/pdf", new TextEncoder().encode("not pdf")),
    ).toMatchObject({ success: false });
    expect(sanitizeDisplayFilename("folder/file.pdf")).toBeNull();
    expect(sanitizeDisplayFilename("  safe   file.pdf  ")).toBe("safe file.pdf");
  });

  it("rejects a file over 10 MB before reading its contents", async () => {
    const file = new File(
      [new Uint8Array(MAX_DOCUMENT_SIZE_BYTES + 1)],
      "oversized.pdf",
      { type: "application/pdf" },
    );

    await expect(validateUploadFile(file)).resolves.toMatchObject({
      message: expect.stringContaining("10 MB"),
      success: false,
    });
  });
});
