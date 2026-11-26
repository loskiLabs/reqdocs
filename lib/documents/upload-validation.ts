import { z } from "zod";
import {
  calculateExpiryDate,
  isDateOnly,
  type ExpiryMethod,
} from "./validity";

export const MAX_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024;

export const ALLOWED_DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
] as const;

export type AllowedDocumentMimeType =
  (typeof ALLOWED_DOCUMENT_MIME_TYPES)[number];

export type DocumentTypeRules = {
  allowsSignedAttestation: boolean;
  defaultDurationMonths: number | null;
  defaultExpiryMethod: ExpiryMethod;
  id: string;
  label: string;
  requiresYear: boolean;
};

export type ValidatedDocumentMetadata = {
  description: string | null;
  displayName: string;
  documentTypeId: string;
  durationMonths: number | null;
  expiresOn: string | null;
  expiryMethod: ExpiryMethod;
  issuer: string | null;
  referenceYear: number | null;
  signedAttested: boolean;
  validFrom: string;
};

export type UploadFileValidation =
  | {
      extension: "jpg" | "pdf" | "png";
      mimeType: AllowedDocumentMimeType;
      success: true;
    }
  | { message: string; success: false };

const optionalText = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value));

const metadataSchema = z.object({
  description: optionalText.pipe(z.string().max(500).nullable()),
  displayName: z.string().trim().min(1).max(160),
  documentTypeId: z.string().regex(/^[a-z0-9_]+$/),
  durationMonths: z.union([z.literal(""), z.coerce.number().int().min(1).max(120)]),
  expiresOn: z.string(),
  expiryMethod: z.enum(["duration", "fixed_date", "none"]),
  issuer: optionalText.pipe(z.string().max(160).nullable()),
  referenceYear: z.union([
    z.literal(""),
    z.coerce.number().int().min(2000).max(2100),
  ]),
  signedAttested: z.enum(["true", "false"]),
  validFrom: z.string(),
});

export type MetadataValidationResult =
  | { data: ValidatedDocumentMetadata; success: true }
  | { fieldErrors: Record<string, string>; success: false };

function firstZodErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};

  for (const issue of error.issues) {
    const field = issue.path[0];
    if (typeof field === "string" && !errors[field]) {
      errors[field] = issue.message;
    }
  }

  return errors;
}

export function validateDocumentMetadata(
  raw: Record<string, string>,
  documentType: DocumentTypeRules | undefined,
  today: string,
): MetadataValidationResult {
  const parsed = metadataSchema.safeParse(raw);

  if (!parsed.success) {
    return { fieldErrors: firstZodErrors(parsed.error), success: false };
  }

  const values = parsed.data;
  const fieldErrors: Record<string, string> = {};

  if (!documentType || documentType.id !== values.documentTypeId) {
    fieldErrors.documentTypeId = "Select a valid document type.";
  }

  if (!isDateOnly(values.validFrom)) {
    fieldErrors.validFrom = "Enter a valid date.";
  } else if (values.validFrom > today) {
    fieldErrors.validFrom = "The document date cannot be in the future.";
  }

  let durationMonths: number | null = null;
  let expiresOn: string | null = null;

  if (values.expiryMethod === "duration") {
    if (values.durationMonths === "") {
      fieldErrors.durationMonths = "Enter how many calendar months it is valid.";
    } else if (isDateOnly(values.validFrom)) {
      durationMonths = values.durationMonths;
      expiresOn = calculateExpiryDate(values.validFrom, durationMonths);
    }
  }

  if (values.expiryMethod === "fixed_date") {
    if (!isDateOnly(values.expiresOn)) {
      fieldErrors.expiresOn = "Enter a valid expiry date.";
    } else if (
      isDateOnly(values.validFrom) &&
      values.expiresOn < values.validFrom
    ) {
      fieldErrors.expiresOn = "The expiry date cannot be before the document date.";
    } else {
      expiresOn = values.expiresOn;
    }
  }

  if (values.expiryMethod === "none" && documentType?.id !== "identity_document") {
    fieldErrors.expiryMethod =
      "No-expiry metadata is available only for identity documents in this MVP.";
  }

  const referenceYear =
    values.referenceYear === "" ? null : values.referenceYear;
  if (documentType?.requiresYear && referenceYear === null) {
    fieldErrors.referenceYear = "Enter the academic or bursary year.";
  }

  const signedAttested = values.signedAttested === "true";
  if (documentType?.allowsSignedAttestation && !signedAttested) {
    fieldErrors.signedAttested =
      "Confirm that you completed and signed this form.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors, success: false };
  }

  return {
    data: {
      description: values.description,
      displayName: values.displayName,
      documentTypeId: values.documentTypeId,
      durationMonths,
      expiresOn,
      expiryMethod: values.expiryMethod,
      issuer: values.issuer,
      referenceYear,
      signedAttested,
      validFrom: values.validFrom,
    },
    success: true,
  };
}

export function sanitizeDisplayFilename(filename: string): string | null {
  if (filename.includes("/") || filename.includes("\\")) {
    return null;
  }

  const sanitized = filename
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 255);

  return sanitized.length > 0 ? sanitized : null;
}

export function validateFileBytes(
  mimeType: string,
  bytes: Uint8Array,
): UploadFileValidation {
  if (!ALLOWED_DOCUMENT_MIME_TYPES.includes(mimeType as AllowedDocumentMimeType)) {
    return {
      message: "Upload a PDF, JPG or PNG file.",
      success: false,
    };
  }

  const matches =
    (mimeType === "application/pdf" &&
      bytes.length >= 5 &&
      String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-") ||
    (mimeType === "image/jpeg" &&
      bytes.length >= 3 &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff) ||
    (mimeType === "image/png" &&
      bytes.length >= 8 &&
      [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every(
        (value, index) => bytes[index] === value,
      ));

  if (!matches) {
    return {
      message: "The file contents do not match the selected file type.",
      success: false,
    };
  }

  const extension =
    mimeType === "application/pdf"
      ? "pdf"
      : mimeType === "image/jpeg"
        ? "jpg"
        : "png";

  return {
    extension,
    mimeType: mimeType as AllowedDocumentMimeType,
    success: true,
  };
}

export async function validateUploadFile(
  value: FormDataEntryValue | null,
): Promise<UploadFileValidation & { file?: File; originalFilename?: string }> {
  if (!(value instanceof File) || value.size === 0) {
    return { message: "Choose a file to upload.", success: false };
  }

  if (value.size > MAX_DOCUMENT_SIZE_BYTES) {
    return {
      message: "The file must be 10 MB or smaller.",
      success: false,
    };
  }

  const originalFilename = sanitizeDisplayFilename(value.name);
  if (!originalFilename) {
    return {
      message: "Rename the file without folder characters and try again.",
      success: false,
    };
  }

  const header = new Uint8Array(await value.slice(0, 16).arrayBuffer());
  const byteValidation = validateFileBytes(value.type, header);

  if (!byteValidation.success) {
    return byteValidation;
  }

  return { ...byteValidation, file: value, originalFilename };
}
