const trackingQueryNames = new Set([
  "fbclid",
  "gclid",
  "dclid",
  "gbraid",
  "wbraid",
  "msclkid",
  "mc_cid",
  "mc_eid",
  "igshid",
]);

export function normalizeUrl(
  value: string,
  options: { errorMessage?: string } = {},
) {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("Unsupported protocol");
    }

    url.protocol = url.protocol.toLowerCase();
    url.hostname = url.hostname.toLowerCase();
    url.hash = "";

    for (const name of Array.from(url.searchParams.keys())) {
      const normalizedName = name.toLowerCase();
      if (
        normalizedName.startsWith("utm_") ||
        trackingQueryNames.has(normalizedName)
      ) {
        url.searchParams.delete(name);
      }
    }

    return url.toString();
  } catch {
    throw new Error(
      options.errorMessage ?? "Submitted Feed URL must be a valid HTTP URL",
    );
  }
}
