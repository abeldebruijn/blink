import type { ReactNode } from "react";
import { ExternalLink } from "lucide-react";

type MarkdownBlock =
  | { kind: "heading"; level: 2 | 3 | 4; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "blockquote"; text: string }
  | { kind: "list"; ordered: boolean; items: string[] };

export function MarkdownContent({ markdown, baseUrl }: { markdown: string; baseUrl?: string }) {
  const blocks = parseMarkdownBlocks(markdown);

  return (
    <div className="grid gap-5 text-[18px] leading-8 text-white/90 sm:text-[19px] sm:leading-9 break-words min-w-0 w-full">
      {blocks.map((block, index) => {
        if (block.kind === "heading") {
          const HeadingTag = `h${block.level}` as "h2" | "h3" | "h4";
          return (
            <HeadingTag
              key={index}
              className="mt-7 text-[25px] font-black leading-tight text-white first:mt-0 sm:text-[30px] min-w-0 w-full break-words"
              style={{ fontFamily: "var(--font-hanken-grotesk), sans-serif" }}
            >
              {renderInline(block.text, baseUrl)}
            </HeadingTag>
          );
        }

        if (block.kind === "blockquote") {
          return (
            <blockquote
              key={index}
              className="border-l-4 border-[#d8ef7f] bg-white/10 px-5 py-4 text-white/80 min-w-0 w-full break-words"
            >
              {renderInline(block.text, baseUrl)}
            </blockquote>
          );
        }

        if (block.kind === "list") {
          const ListTag = block.ordered ? "ol" : "ul";
          return (
            <ListTag
              key={index}
              className={`grid gap-2 pl-6 min-w-0 w-full break-words ${
                block.ordered ? "list-decimal" : "list-disc"
              }`}
            >
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex} className="min-w-0 w-full break-words">
                  {renderInline(item, baseUrl)}
                </li>
              ))}
            </ListTag>
          );
        }

        return (
          <p key={index} className="min-w-0 w-full break-words">
            {renderInline(block.text, baseUrl)}
          </p>
        );
      })}
    </div>
  );
}

function parseMarkdownBlocks(markdown: string) {
  const blocks: MarkdownBlock[] = [];
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  function flushParagraph() {
    if (paragraph.length === 0) {
      return;
    }
    blocks.push({ kind: "paragraph", text: paragraph.join(" ") });
    paragraph = [];
  }

  function flushList() {
    if (list === null) {
      return;
    }
    blocks.push({ kind: "list", ordered: list.ordered, items: list.items });
    list = null;
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line === "") {
      flushParagraph();
      flushList();
      continue;
    }

    const heading = /^(#{1,4})\s+(.+)$/.exec(line);
    if (heading !== null) {
      flushParagraph();
      flushList();
      blocks.push({
        kind: "heading",
        level: Math.min(heading[1].length + 1, 4) as 2 | 3 | 4,
        text: heading[2],
      });
      continue;
    }

    if (line.startsWith(">")) {
      flushParagraph();
      flushList();
      blocks.push({
        kind: "blockquote",
        text: line.replace(/^>\s?/, ""),
      });
      continue;
    }

    const unorderedItem = /^[-*]\s+(.+)$/.exec(line);
    const orderedItem = /^\d+[.)]\s+(.+)$/.exec(line);
    const itemText = unorderedItem?.[1] ?? orderedItem?.[1] ?? null;
    if (itemText !== null) {
      flushParagraph();
      const ordered = orderedItem !== null;
      if (list === null || list.ordered !== ordered) {
        flushList();
        list = { ordered, items: [] };
      }
      list.items.push(itemText);
      continue;
    }

    flushList();
    paragraph.push(line);
  }

  flushParagraph();
  flushList();

  return blocks;
}

function renderInline(text: string, baseUrl?: string) {
  const nodes: ReactNode[] = [];
  const pattern =
    /(\[\s*!\[[^\]]*\]\s*\([^)]+\)\s*\]\s*\([^)]+\)|!?\[[^\]]*\]\s*\([^)]+\)|`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > cursor) {
      nodes.push(text.slice(cursor, match.index));
    }

    const token = match[0];
    const key = `${match.index}-${token}`;
    if (token.startsWith("[!") || token.startsWith("[ ![")) {
      // Linked image: [![Alt](img)](link)
      const linkedImgMatch = /^\[\s*!\[([^\]]*)\]\s*\(([^)]+)\)\s*\]\s*\(([^)]+)\)$/.exec(token);
      if (linkedImgMatch !== null) {
        const alt = linkedImgMatch[1];
        const imgSrc = safeExternalHref(linkedImgMatch[2], baseUrl);
        const linkHref = safeExternalHref(linkedImgMatch[3], baseUrl);

        if (imgSrc !== null) {
          const imgEl = (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={imgSrc}
              alt={alt}
              className="my-4 mx-auto max-h-[360px] w-auto max-w-full rounded-[8px] border border-white/10 object-contain shadow-md transition hover:opacity-90"
            />
          );
          if (linkHref !== null) {
            nodes.push(
              <a
                key={key}
                href={linkHref}
                target="_blank"
                rel="noreferrer"
                className="inline-block w-full"
              >
                {imgEl}
              </a>,
            );
          } else {
            nodes.push(
              <div key={key} className="w-full">
                {imgEl}
              </div>,
            );
          }
        } else if (linkHref !== null) {
          nodes.push(
            <a
              key={key}
              href={linkHref}
              target="_blank"
              rel="noreferrer"
              className="font-bold text-[#d8ef7f] underline decoration-[#d8ef7f]/35 underline-offset-4 transition hover:text-[#d8ef7f]/80 break-words"
            >
              {alt || "Link"}
              <ExternalLink className="inline-block size-3.5 align-middle ml-1" aria-hidden="true" />
            </a>,
          );
        } else {
          nodes.push(token);
        }
      } else {
        nodes.push(token);
      }
    } else if (token.startsWith("`")) {
      nodes.push(
        <code
          key={key}
          className="rounded bg-white/12 px-1 py-0.5 text-[0.86em] break-all"
          style={{ fontFamily: "var(--font-geist-mono), monospace" }}
        >
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith("**")) {
      nodes.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("*")) {
      nodes.push(<em key={key}>{token.slice(1, -1)}</em>);
    } else if (token.startsWith("![")) {
      // Markdown Image
      const imgMatch = /^!\[([^\]]*)\]\s*\(([^)]+)\)$/.exec(token);
      const src = imgMatch === null ? null : safeExternalHref(imgMatch[2], baseUrl);
      if (imgMatch !== null && src !== null) {
        nodes.push(
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            key={key}
            src={src}
            alt={imgMatch[1]}
            className="my-4 mx-auto max-h-[360px] w-auto max-w-full rounded-[8px] border border-white/10 object-contain shadow-md"
          />,
        );
      } else {
        nodes.push(token);
      }
    } else {
      // Markdown Link
      const link = /^\[([^\]]*)\]\s*\(([^)]+)\)$/.exec(token);
      const href = link === null ? null : safeExternalHref(link[2], baseUrl);
      if (link !== null && href !== null) {
        nodes.push(
          <a
            key={key}
            href={href}
            target="_blank"
            rel="noreferrer"
            className="font-bold text-[#d8ef7f] underline decoration-[#d8ef7f]/35 underline-offset-4 transition hover:text-[#d8ef7f]/80 break-words"
          >
            {link[1]}
            <ExternalLink className="inline-block size-3.5 align-middle ml-1" aria-hidden="true" />
          </a>,
        );
      } else {
        nodes.push(token);
      }
    }

    cursor = match.index + token.length;
  }

  if (cursor < text.length) {
    nodes.push(text.slice(cursor));
  }

  return nodes;
}

function safeExternalHref(value: string, baseUrl?: string) {
  try {
    const url = baseUrl ? new URL(value, baseUrl) : new URL(value);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return url.toString();
    }
  } catch {
    // Check if it's a safe path or hash
    if (value.startsWith("/") || value.startsWith("#") || value.startsWith("?")) {
      return value;
    }
    return null;
  }
  return null;
}
