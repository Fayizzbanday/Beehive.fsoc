import { describe, it, expect } from "vitest";
import {
  canonicalJson,
  canonicalizeRecord,
  hashRecord,
  sha256,
  integrityVerdict,
} from "../packages/shared/src/canonical";
import { goldenRecord } from "./fixtures";
describe("canonical certification", () => {
  it("matches a known SHA-256 test vector", async () => {
    expect(await sha256("abc")).toBe(
      "0xba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
  it("normalizes object order and whitespace", async () => {
    const shuffled = Object.fromEntries(
      Object.entries(goldenRecord).reverse(),
    ) as typeof goldenRecord;
    expect(await hashRecord(shuffled)).toBe(
      await hashRecord({
        ...goldenRecord,
        producerName: " Mountain  Gold Apiary ",
      }),
    );
  });
  it("normalizes source-set order and UTC instants", async () => {
    expect(
      await hashRecord({
        ...goldenRecord,
        hiveIds: ["B", "A"],
        createdAt: "2026-09-06T13:30:00+05:30",
      }),
    ).toBe(await hashRecord({ ...goldenRecord, hiveIds: ["A", "B"] }));
  });
  it("normalizes Unicode and signed zero", () => {
    expect(canonicalJson({ x: "e\u0301", y: -0 })).toBe(
      canonicalJson({ y: 0, x: "é" }),
    );
  });
  it("rejects unknown fields and duplicate sources", () => {
    expect(() =>
      canonicalizeRecord({
        ...goldenRecord,
        secret: "private",
      } as typeof goldenRecord),
    ).toThrow();
    expect(() =>
      canonicalizeRecord({ ...goldenRecord, hiveIds: ["A", " A "] }),
    ).toThrow();
  });
  it("rejects undefined and non-finite numbers", () => {
    expect(() => canonicalJson({ x: undefined })).toThrow();
    expect(() => canonicalJson(NaN)).toThrow();
  });
  it("preserves null and meaningful array ordering", () => {
    expect(canonicalJson({ a: null })).not.toBe(canonicalJson({}));
    expect(canonicalJson([1, 2])).not.toBe(canonicalJson([2, 1]));
  });
  it("changes the hash for every certified field mutation", async () => {
    const original = await hashRecord(goldenRecord);
    for (const changed of [
      { ...goldenRecord, quantity: 250 },
      { ...goldenRecord, quantity: 25.000001 },
      { ...goldenRecord, honeyType: "Multiflora" },
      {
        ...goldenRecord,
        qualityMeasurements: {
          ...goldenRecord.qualityMeasurements,
          moisture: 19,
        },
      },
      { ...goldenRecord, origin: { ...goldenRecord.origin, region: "Punjab" } },
    ])
      expect(await hashRecord(changed)).not.toBe(original);
  });
  it("detects tampering and restoration", async () => {
    const a = await hashRecord(goldenRecord);
    const b = await hashRecord({ ...goldenRecord, quantity: 250 });
    expect(integrityVerdict(a, a, true)).toBe("AUTHENTIC");
    expect(integrityVerdict(b, a, true)).toBe("TAMPERED");
    expect(integrityVerdict(a, a, true)).toBe("AUTHENTIC");
    expect(integrityVerdict(a, null, false)).toBe("PENDING");
    expect(integrityVerdict(a, a, false)).toBe("PENDING");
    expect(integrityVerdict(a, a, true, true)).toBe("REVOKED");
  });
});
