"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { DocumentStatus } from "./document-status";
import {
  calculateDocumentStatus,
  calculateExpiryDate,
  getRemainingDaysMessage,
  getStatusLabel,
  type ExpiryMethod,
} from "@/lib/documents/validity";
import type { DocumentTypeRules } from "@/lib/documents/upload-validation";

type DocumentFormValues = {
  description: string;
  displayName: string;
  documentTypeId: string;
  durationMonths: number | "";
  expiresOn: string;
  expiryMethod: ExpiryMethod;
  file: FileList;
  issuer: string;
  referenceYear: number | "";
  signedAttested: boolean;
  validFrom: string;
};

export type InitialDocumentValues = Omit<DocumentFormValues, "file"> & {
  id: string;
};

type ApiErrorBody = {
  error?: {
    fieldErrors?: Record<string, string>;
    message?: string;
  };
};

function FieldError({ message }: { message?: string }) {
  return message ? (
    <p className="mt-2 text-sm font-medium text-red-700">{message}</p>
  ) : null;
}

const inputClass =
  "mt-2 min-h-12 w-full border border-slate-400 bg-white px-3 text-base text-[var(--foreground)] focus:border-[var(--primary)]";

export function DocumentForm({
  documentTypes,
  initialDocument,
  initialDocumentTypeId,
  mode,
  returnTo,
  today,
}: {
  documentTypes: DocumentTypeRules[];
  initialDocument?: InitialDocumentValues;
  initialDocumentTypeId?: string;
  mode: "create" | "replace";
  returnTo?: string;
  today: string;
}) {
  const router = useRouter();
  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const firstType =
    documentTypes.find((type) => type.id === initialDocumentTypeId) ??
    documentTypes[0];
  const defaults: Omit<DocumentFormValues, "file"> = initialDocument
    ? {
        description: initialDocument.description,
        displayName: initialDocument.displayName,
        documentTypeId: initialDocument.documentTypeId,
        durationMonths: initialDocument.durationMonths,
        expiresOn: initialDocument.expiresOn,
        expiryMethod: initialDocument.expiryMethod,
        issuer: initialDocument.issuer,
        referenceYear: initialDocument.referenceYear,
        signedAttested: initialDocument.signedAttested,
        validFrom: initialDocument.validFrom,
      }
    : {
        description: "",
        displayName: firstType?.label ?? "",
        documentTypeId: firstType?.id ?? "",
        durationMonths: firstType?.defaultDurationMonths ?? "",
        expiresOn: "",
        expiryMethod: firstType?.defaultExpiryMethod ?? "duration",
        issuer: "",
        referenceYear: "",
        signedAttested: false,
        validFrom: "",
      };
  const {
    control,
    formState: { isSubmitting },
    handleSubmit,
    register,
    setValue,
  } = useForm<DocumentFormValues>({ defaultValues: defaults });
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const documentTypeId = useWatch({ control, name: "documentTypeId" });
  const durationMonths = useWatch({ control, name: "durationMonths" });
  const expiresOn = useWatch({ control, name: "expiresOn" });
  const expiryMethod = useWatch({ control, name: "expiryMethod" });
  const validFrom = useWatch({ control, name: "validFrom" });
  const selectedType = documentTypes.find((type) => type.id === documentTypeId);

  const expiryPreview = useMemo(() => {
    try {
      if (expiryMethod === "duration" && validFrom && durationMonths !== "") {
        return calculateExpiryDate(validFrom, Number(durationMonths));
      }
      if (expiryMethod === "fixed_date" && expiresOn) return expiresOn;
      if (expiryMethod === "none") return null;
    } catch {
      return undefined;
    }

    return undefined;
  }, [durationMonths, expiresOn, expiryMethod, validFrom]);

  const statusPreview = useMemo(() => {
    if (expiryPreview === undefined) return null;
    try {
      return calculateDocumentStatus(expiryPreview, 21, today);
    } catch {
      return null;
    }
  }, [expiryPreview, today]);

  useEffect(() => {
    if (formError) {
      errorSummaryRef.current?.focus();
    }
  }, [formError]);

  function handleTypeChange(typeId: string) {
    const nextType = documentTypes.find((type) => type.id === typeId);
    if (!nextType) return;

    setValue("documentTypeId", nextType.id);
    setValue("displayName", nextType.label);
    setValue("expiryMethod", nextType.defaultExpiryMethod);
    setValue("durationMonths", nextType.defaultDurationMonths ?? "");
    setValue("expiresOn", "");
    setValue("referenceYear", "");
    setValue("signedAttested", false);
  }

  async function submit(values: DocumentFormValues) {
    setFormError("");
    setFieldErrors({});

    const file = values.file?.item(0);
    const formData = new FormData();
    formData.set("description", values.description);
    formData.set("displayName", values.displayName);
    formData.set("documentTypeId", values.documentTypeId);
    formData.set("durationMonths", String(values.durationMonths));
    formData.set("expiresOn", values.expiresOn);
    formData.set("expiryMethod", values.expiryMethod);
    formData.set("issuer", values.issuer);
    formData.set("referenceYear", String(values.referenceYear));
    formData.set("signedAttested", String(values.signedAttested));
    formData.set("validFrom", values.validFrom);
    if (file) formData.set("file", file);

    const endpoint =
      mode === "create"
        ? "/api/documents"
        : `/api/documents/${initialDocument?.id ?? ""}/replace`;

    try {
      const response = await fetch(endpoint, { body: formData, method: "POST" });
      const body = (await response.json()) as ApiErrorBody;

      if (!response.ok) {
        setFieldErrors(body.error?.fieldErrors ?? {});
        setFormError(
          body.error?.message ?? "We could not save this document. Try again.",
        );
        return;
      }

      router.push(returnTo ?? `/vault?${mode === "create" ? "added" : "replaced"}=1`);
      router.refresh();
    } catch {
      setFormError(
        "We could not save this document. Check your connection and try again.",
      );
    }
  }

  if (documentTypes.length === 0) {
    return (
      <p className="border border-red-200 bg-red-50 p-4 text-red-800">
        Document types are unavailable. Apply the Supabase seed migration and
        reload this page.
      </p>
    );
  }

  return (
    <form
      className="space-y-8"
      encType="multipart/form-data"
      noValidate
      onSubmit={handleSubmit(submit)}
    >
      {formError ? (
        <div
          aria-labelledby="document-form-error-title"
          className="border-l-4 border-red-700 bg-red-50 p-4"
          ref={errorSummaryRef}
          role="alert"
          tabIndex={-1}
        >
          <h2 className="font-bold text-red-900" id="document-form-error-title">
            Check this document
          </h2>
          <p className="mt-1 text-sm text-red-800">{formError}</p>
        </div>
      ) : null}

      <fieldset className="border border-[var(--border)] bg-white p-5 sm:p-7">
        <legend className="px-2 text-xl font-bold">1. Document</legend>
        <div className="mt-3 grid gap-5 sm:grid-cols-2">
          <label className="font-bold" htmlFor="documentTypeId">
            Document type
            <select
              aria-invalid={Boolean(fieldErrors.documentTypeId)}
              className={inputClass}
              id="documentTypeId"
              {...register("documentTypeId", {
                onChange: (event) => handleTypeChange(event.target.value),
                required: true,
              })}
            >
              {documentTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.label}
                </option>
              ))}
            </select>
            <FieldError message={fieldErrors.documentTypeId} />
          </label>
          <label className="font-bold" htmlFor="displayName">
            Display name
            <input
              aria-invalid={Boolean(fieldErrors.displayName)}
              className={inputClass}
              id="displayName"
              maxLength={160}
              required
              {...register("displayName")}
            />
            <FieldError message={fieldErrors.displayName} />
          </label>
        </div>
        <label className="mt-5 block font-bold" htmlFor="file">
          {mode === "replace" ? "Replacement file" : "File"}
          <input
            accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png"
            aria-describedby="file-help"
            aria-invalid={Boolean(fieldErrors.file)}
            className={`${inputClass} py-2 file:mr-3 file:min-h-9 file:border-0 file:bg-blue-50 file:px-3 file:font-bold file:text-[var(--primary)]`}
            id="file"
            required
            type="file"
            {...register("file")}
          />
          <span
            className="mt-2 block text-sm font-normal text-[var(--muted)]"
            id="file-help"
          >
            PDF, JPG or PNG. Maximum 10 MB. Use fictional documents for this demo.
          </span>
          <FieldError message={fieldErrors.file} />
        </label>
      </fieldset>

      <fieldset className="border border-[var(--border)] bg-white p-5 sm:p-7">
        <legend className="px-2 text-xl font-bold">2. Dates and validity</legend>
        <label className="mt-3 block max-w-sm font-bold" htmlFor="validFrom">
          Valid-from, issue or certification date
          <input
            aria-invalid={Boolean(fieldErrors.validFrom)}
            className={inputClass}
            id="validFrom"
            max={today}
            required
            type="date"
            {...register("validFrom")}
          />
          <FieldError message={fieldErrors.validFrom} />
        </label>

        <label className="mt-5 block max-w-sm font-bold" htmlFor="expiryMethod">
          Expiration method
          <select
            aria-invalid={Boolean(fieldErrors.expiryMethod)}
            className={inputClass}
            id="expiryMethod"
            {...register("expiryMethod")}
          >
            <option value="duration">Valid for a period</option>
            <option value="fixed_date">Fixed expiry date</option>
            {selectedType?.id === "identity_document" ? (
              <option value="none">No expiry recorded</option>
            ) : null}
          </select>
          <FieldError message={fieldErrors.expiryMethod} />
        </label>

        {expiryMethod === "duration" ? (
          <label className="mt-5 block max-w-sm font-bold" htmlFor="durationMonths">
            Valid for how many calendar months?
            <input
              aria-invalid={Boolean(fieldErrors.durationMonths)}
              className={inputClass}
              id="durationMonths"
              max={120}
              min={1}
              required
              type="number"
              {...register("durationMonths", { valueAsNumber: true })}
            />
            <FieldError message={fieldErrors.durationMonths} />
          </label>
        ) : null}

        {expiryMethod === "fixed_date" ? (
          <label className="mt-5 block max-w-sm font-bold" htmlFor="expiresOn">
            Expiry date
            <input
              aria-invalid={Boolean(fieldErrors.expiresOn)}
              className={inputClass}
              id="expiresOn"
              min={validFrom || undefined}
              required
              type="date"
              {...register("expiresOn")}
            />
            <FieldError message={fieldErrors.expiresOn} />
          </label>
        ) : null}

        {statusPreview ? (
          <section
            aria-labelledby="validity-preview-heading"
            className="mt-6 border-l-4 border-[var(--primary)] bg-blue-50 p-4"
          >
            <h2 className="font-bold" id="validity-preview-heading">
              Calculated validity
            </h2>
            <div className="mt-3">
              <DocumentStatus
                label={getStatusLabel(statusPreview.status)}
                status={statusPreview.status}
              />
            </div>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {expiryPreview
                ? `Calculated expiry: ${expiryPreview}. `
                : "No expiry date will be recorded. "}
              {getRemainingDaysMessage(statusPreview)}
            </p>
          </section>
        ) : null}
      </fieldset>

      <fieldset className="border border-[var(--border)] bg-white p-5 sm:p-7">
        <legend className="px-2 text-xl font-bold">
          3. Service-specific information
        </legend>
        {selectedType?.requiresYear ? (
          <label className="mt-3 block max-w-sm font-bold" htmlFor="referenceYear">
            Academic or bursary year
            <input
              aria-invalid={Boolean(fieldErrors.referenceYear)}
              className={inputClass}
              id="referenceYear"
              max={2100}
              min={2000}
              required
              type="number"
              {...register("referenceYear", { valueAsNumber: true })}
            />
            <FieldError message={fieldErrors.referenceYear} />
          </label>
        ) : (
          <p className="mt-3 text-[var(--muted)]">
            This document type does not need an academic or bursary year.
          </p>
        )}

        {selectedType?.allowsSignedAttestation ? (
          <label className="mt-5 flex min-h-12 items-start gap-3 font-bold">
            <input
              aria-invalid={Boolean(fieldErrors.signedAttested)}
              className="mt-1 size-5"
              type="checkbox"
              {...register("signedAttested")}
            />
            <span>
              I confirm that I completed and signed this form.
              <FieldError message={fieldErrors.signedAttested} />
            </span>
          </label>
        ) : null}

        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <label className="font-bold" htmlFor="issuer">
            Issuer <span className="font-normal text-[var(--muted)]">(optional)</span>
            <input
              aria-invalid={Boolean(fieldErrors.issuer)}
              className={inputClass}
              id="issuer"
              maxLength={160}
              {...register("issuer")}
            />
            <FieldError message={fieldErrors.issuer} />
          </label>
          <label className="font-bold" htmlFor="description">
            Description{" "}
            <span className="font-normal text-[var(--muted)]">(optional)</span>
            <textarea
              aria-invalid={Boolean(fieldErrors.description)}
              className={`${inputClass} min-h-28 py-3`}
              id="description"
              maxLength={500}
              {...register("description")}
            />
            <FieldError message={fieldErrors.description} />
          </label>
        </div>
      </fieldset>

      <section
        aria-labelledby="document-review-heading"
        className="border border-[var(--border)] bg-white p-5 sm:p-7"
      >
        <h2 className="text-xl font-bold" id="document-review-heading">
          4. Review
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
          ReqDocs checks the dates and information you provide. It does not verify
          that a document is authentic or guarantee that an organisation will
          accept it.
        </p>
        <button
          className="mt-5 min-h-12 w-full bg-[var(--primary)] px-5 font-bold text-white hover:bg-[var(--primary-hover)] disabled:cursor-wait disabled:opacity-70 sm:w-auto"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting
            ? "Saving…"
            : mode === "replace"
              ? "Save replacement"
              : "Save document"}
        </button>
      </section>
    </form>
  );
}
