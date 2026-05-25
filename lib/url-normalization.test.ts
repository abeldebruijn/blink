import { describe, expect, test } from "vitest";

import { normalizeUrl } from "./url-normalization";

describe("normalizeUrl", () => {
  test("lowercases the URL scheme and host", () => {
    expect(normalizeUrl("HTTPS://EXAMPLE.COM/Posts/One")).toBe(
      "https://example.com/Posts/One",
    );
  });

  test("strips URL fragments", () => {
    expect(
      normalizeUrl("https://example.com/posts/one?reader=1#comments"),
    ).toBe("https://example.com/posts/one?reader=1");
  });

  test("strips common tracking query parameters while preserving identity query parameters", () => {
    expect(
      normalizeUrl(
        "https://example.com/post?id=123&utm_source=feed&fbclid=abc&ref=home&MSCLKID=xyz",
      ),
    ).toBe("https://example.com/post?id=123&ref=home");
  });

  test("removes tracking parameters no matter where they appear in the query", () => {
    expect(
      normalizeUrl("https://example.com/post?utm_medium=email&id=123&utm_term=x"),
    ).toBe("https://example.com/post?id=123");
  });

  test("preserves path casing and non-tracking query details", () => {
    expect(
      normalizeUrl("https://Example.com/Case/Sensitive?Tag=JS&sort=New"),
    ).toBe("https://example.com/Case/Sensitive?Tag=JS&sort=New");
  });

  test("rejects non-HTTP URLs", () => {
    expect(() => normalizeUrl("mailto:reader@example.com")).toThrow(
      "Submitted Feed URL must be a valid HTTP URL",
    );
  });

  test("supports caller-specific error messages", () => {
    expect(() =>
      normalizeUrl("not a url", {
        errorMessage: "RSS entry link is not a valid URL",
      }),
    ).toThrow("RSS entry link is not a valid URL");
  });
});
