import { afterEach, describe, expect, it } from "vitest";
import { getPublicSupabaseConfig } from "./config";

const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const originalAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

afterEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalAnonKey;
});

describe("getPublicSupabaseConfig", () => {
  it("returns the public configuration when both values are set", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "fictional-anon-key";

    expect(getPublicSupabaseConfig()).toEqual({
      anonKey: "fictional-anon-key",
      url: "https://project.supabase.co",
    });
  });

  it("fails with a safe setup message when configuration is missing", () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    expect(getPublicSupabaseConfig).toThrow("Supabase is not configured");
  });
});
