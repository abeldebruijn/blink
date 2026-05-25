import assert from "node:assert/strict";
import test from "node:test";

import { normalizeUrl } from "./url-normalization.ts";

test("lowercases the URL scheme and host", () => {
  assert.equal(
    normalizeUrl("HTTPS://EXAMPLE.COM/Posts/One"),
    "https://example.com/Posts/One",
  );
});

test("strips URL fragments", () => {
  assert.equal(
    normalizeUrl("https://example.com/posts/one?reader=1#comments"),
    "https://example.com/posts/one?reader=1",
  );
});

test("strips common tracking query parameters while preserving identity query parameters", () => {
  assert.equal(
    normalizeUrl(
      "https://example.com/post?id=123&utm_source=feed&fbclid=abc&ref=home&MSCLKID=xyz",
    ),
    "https://example.com/post?id=123&ref=home",
  );
});

test("removes tracking parameters no matter where they appear in the query", () => {
  assert.equal(
    normalizeUrl("https://example.com/post?utm_medium=email&id=123&utm_term=x"),
    "https://example.com/post?id=123",
  );
});

test("preserves path casing and non-tracking query details", () => {
  assert.equal(
    normalizeUrl("https://Example.com/Case/Sensitive?Tag=JS&sort=New"),
    "https://example.com/Case/Sensitive?Tag=JS&sort=New",
  );
});

test("rejects non-HTTP URLs", () => {
  assert.throws(
    () => normalizeUrl("mailto:reader@example.com"),
    /Submitted Feed URL must be a valid HTTP URL/,
  );
});

test("supports caller-specific error messages", () => {
  assert.throws(
    () =>
      normalizeUrl("not a url", {
        errorMessage: "RSS entry link is not a valid URL",
      }),
    /RSS entry link is not a valid URL/,
  );
});
