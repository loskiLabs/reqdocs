import { createHmac, randomInt } from "node:crypto";

export function getAccessCodeSecret(): string {
  const secret = process.env.ACCESS_CODE_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("ACCESS_CODE_SECRET must contain at least 32 characters.");
  }
  return secret;
}

export function generateAccessCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function hashAccessCode(value: string, secret = getAccessCodeSecret()): string {
  return createHmac("sha256", secret).update(value, "utf8").digest("hex");
}

export function hashRedemptionSource(value: string, secret = getAccessCodeSecret()): string {
  return createHmac("sha256", secret).update(`source:${value}`, "utf8").digest("hex");
}
