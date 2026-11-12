import test from "node:test";
import assert from "node:assert/strict";
import { detectAttachmentExtension } from "../src/lib/attachment-validation.js";

test("accepts PDF files with a PDF signature", () => {
  assert.equal(detectAttachmentExtension("application/pdf", new TextEncoder().encode("%PDF-1.7")), "pdf");
});

test("accepts JPEG files with a JPEG signature", () => {
  assert.equal(detectAttachmentExtension("image/jpeg", new Uint8Array([0xff, 0xd8, 0xff, 0xdb])), "jpg");
});

test("accepts PNG files with the eight-byte PNG signature", () => {
  assert.equal(detectAttachmentExtension("image/png", new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])), "png");
});

test("accepts WebP files with RIFF and WEBP markers", () => {
  const bytes = new Uint8Array(12);
  bytes.set(new TextEncoder().encode("RIFF"), 0);
  bytes.set(new TextEncoder().encode("WEBP"), 8);
  assert.equal(detectAttachmentExtension("image/webp", bytes), "webp");
});

test("rejects mismatched and unsupported file signatures", () => {
  assert.equal(detectAttachmentExtension("image/png", new TextEncoder().encode("%PDF-1.7")), null);
  assert.equal(detectAttachmentExtension("image/svg+xml", new TextEncoder().encode("<svg/>")), null);
  assert.equal(detectAttachmentExtension("image/png", new Uint8Array([137, 80, 78])), null);
});
