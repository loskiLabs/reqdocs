import { describe, expect, it } from "vitest";
import { generateAccessCode, hashAccessCode, hashRedemptionSource } from "./crypto";

const secret = "fictional-test-secret-that-is-long-enough";

describe("access-code cryptography", () => {
  it("generates exactly six decimal digits", () => {
    for (let index = 0; index < 50; index += 1) expect(generateAccessCode()).toMatch(/^\d{6}$/);
  });
  it("uses deterministic, domain-separated 64-character HMAC values", () => {
    expect(hashAccessCode("123456", secret)).toHaveLength(64);
    expect(hashAccessCode("123456", secret)).toBe(hashAccessCode("123456", secret));
    expect(hashAccessCode("123456", secret)).not.toBe(hashRedemptionSource("123456", secret));
  });
});
