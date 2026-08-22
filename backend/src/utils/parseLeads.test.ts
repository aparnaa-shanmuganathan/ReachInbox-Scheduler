import { describe, expect, it } from "vitest";
import { parseRecipientsFromBuffer } from "./parseLeads";

describe("parseRecipientsFromBuffer", () => {
  it("extracts emails from a single-column list", () => {
    const buf = Buffer.from("alice@example.com\nbob@example.com\n");
    expect(parseRecipientsFromBuffer(buf)).toEqual(["alice@example.com", "bob@example.com"]);
  });

  it("extracts emails from a multi-column CSV with headers", () => {
    const buf = Buffer.from(
      "name,email,company\nAlice,alice@example.com,Acme\nBob,bob@example.com,Widgets Inc",
    );
    expect(parseRecipientsFromBuffer(buf)).toEqual(["alice@example.com", "bob@example.com"]);
  });

  it("dedupes and lowercases", () => {
    const buf = Buffer.from("Alice@Example.com\nalice@example.com\nALICE@EXAMPLE.COM");
    expect(parseRecipientsFromBuffer(buf)).toEqual(["alice@example.com"]);
  });

  it("ignores malformed rows without valid emails", () => {
    const buf = Buffer.from("not-an-email\n,,,\nvalid@example.com");
    expect(parseRecipientsFromBuffer(buf)).toEqual(["valid@example.com"]);
  });
});
