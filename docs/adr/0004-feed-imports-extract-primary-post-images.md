# Feed Imports Extract Primary Post Images

Blink will extract one primary image for each imported Feed Post and store it on the Post as `headerImageUrl`.

The import pipeline should prefer cheap, deterministic sources before doing extra page work. RSS and Atom entries often contain the canonical image directly in structured media fields, enclosures, or inline HTML descriptions. For feeds like xkcd, the image in the RSS description is the actual post content and should be attached immediately without requiring a page scrape.

Image extraction uses this priority order:

1. RSS media fields such as `media:content`, `media:thumbnail`, image `enclosure`, `itunes:image`, and entry `image`.
2. The first valid image in RSS `description`.
3. The first valid image in richer entry content such as `content:encoded`, Atom `summary`, or Atom `content`.
4. Firecrawl metadata images returned from the scraped post page, such as Open Graph or Twitter image metadata.
5. The first valid markdown image in Firecrawl's extracted page content.
6. No image.

Blink stores only one primary image URL for the Post rather than storing all candidates. RSS-provided images take precedence over Firecrawl-discovered images because they are closer to the feed author's intended post content and are available during initial enqueueing. Firecrawl image extraction is a fallback attached during the existing scrape step, avoiding an additional external call dedicated only to images.

Images are referenced by URL instead of being downloaded and cached by Blink. This keeps the import path simple for the current product scope. Image URLs are normalized relative to the post URL when possible, stripped of fragments, and limited to HTTP and HTTPS URLs.

This decision preserves the existing shared Post model: once a Post has a primary image, Home Feed Items can render it for every Reader without duplicating image state per Reader. Future work may add image proxying, caching, dimensions, alt text, or candidate ranking if hotlinking or visual quality becomes a product issue.
