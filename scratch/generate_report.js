const fs = require('fs');
const path = require('path');
const os = require('os');

const htmlContent = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Architecture review — Blink</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script type="module">
      import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";
      mermaid.initialize({ startOnLoad: true, theme: "neutral", securityLevel: "loose" });
    </script>
    <style>
      .seam { stroke-dasharray: 4 4; }
      .leak { stroke: #dc2626; }
      .deep { background: linear-gradient(135deg, #0f172a, #1e293b); }
    </style>
  </head>
  <body class="bg-stone-50 text-slate-900 font-sans">
    <main class="max-w-5xl mx-auto px-6 py-12 space-y-12">
      
      <!-- Header -->
      <header class="border-b border-stone-200 pb-6">
        <h1 class="text-4xl font-serif font-black text-slate-950">Architecture Review — Blink</h1>
        <p class="text-stone-500 text-sm mt-1">Generated on ${new Date().toLocaleDateString()}</p>
        
        <!-- Legend -->
        <div class="mt-4 flex flex-wrap gap-6 text-xs text-stone-600 font-mono bg-white p-4 rounded-lg border border-stone-200">
          <div class="flex items-center gap-2">
            <span class="inline-block w-4 h-4 bg-slate-100 border border-slate-300 rounded"></span>
            <span>Module / Table</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="inline-block w-4 h-4 bg-slate-900 border border-slate-950 rounded"></span>
            <span>Deep Module</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="inline-block w-6 h-0 border-t-2 border-dashed border-stone-400"></span>
            <span>Interface Seam</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="inline-block w-4 h-4 border border-red-500 rounded bg-red-50"></span>
            <span>Leakage / Mismatch</span>
          </div>
        </div>
      </header>

      <!-- Candidates -->
      <section id="candidates" class="space-y-10">
        
        <!-- Candidate 1 -->
        <article class="bg-white border border-stone-200 rounded-xl p-6 shadow-sm space-y-6">
          <div class="flex justify-between items-start flex-wrap gap-4">
            <div>
              <h2 class="text-2xl font-serif font-bold text-slate-900">1. Collapse URL normalization into a single deep module</h2>
              <div class="font-mono text-sm text-stone-500 mt-1">
                lib/feed-imports.ts · workflows/imports.ts · lib/server/feed-preflight.ts
              </div>
            </div>
            <div class="flex gap-2">
              <span class="bg-emerald-100 text-emerald-800 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-emerald-300">Strong</span>
              <span class="bg-slate-100 text-slate-800 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-slate-300">in-process</span>
            </div>
          </div>

          <!-- Before/After -->
          <div class="grid md:grid-cols-2 gap-6">
            <div class="border border-stone-150 rounded-lg p-4 bg-stone-50">
              <div class="text-xs uppercase tracking-wider text-stone-400 font-bold mb-2">Before: Multiple shallow normalization functions</div>
              <pre class="mermaid bg-stone-50">
                flowchart TD
                  classDef leak stroke:#dc2626,stroke-width:2px;
                  WF[workflows/imports.ts] --> WFN("normalizedArticleUrl&lt;br&gt;(shallow / local)")
                  FP[lib/server/feed-preflight.ts] --> FPN("normalizeUrl&lt;br&gt;(shallow / duplicate)")
                  FI[lib/feed-imports.ts] --> FIN("normalizeUrl&lt;br&gt;(shallow / duplicate)")
                  class WFN,FPN,FIN leak
              </pre>
            </div>
            <div class="border border-stone-150 rounded-lg p-4 bg-stone-50">
              <div class="text-xs uppercase tracking-wider text-stone-400 font-bold mb-2">After: Unified deep URL normalization module</div>
              <pre class="mermaid bg-stone-50">
                flowchart TD
                  classDef deep fill:#0f172a,stroke:#0f172a,color:#fff;
                  WF[workflows/imports.ts] --> UN
                  FP[lib/server/feed-preflight.ts] --> UN
                  FI[lib/feed-imports.ts] --> UN
                  subgraph Deep Module
                    UN("URL Normalization Module&lt;br&gt;(lib/url-normalization.ts)")
                  end
                  class UN deep
              </pre>
            </div>
          </div>

          <div class="grid md:grid-cols-2 gap-6 text-sm">
            <div>
              <h3 class="font-bold text-slate-800">Problem</h3>
              <p class="text-stone-600 mt-1">The URL normalization logic is shallow and scattered across multiple files, failing to enforce the strict canonical normalization rules specified in the domain context (e.g. lowercasing scheme and host, stripping tracking parameters, and resolving relative images consistently).</p>
            </div>
            <div>
              <h3 class="font-bold text-slate-800">Solution</h3>
              <p class="text-stone-600 mt-1">Consolidate URL normalization into a single deep module that hides parameter filtering and casing logic behind a simple string-in/string-out interface.</p>
            </div>
          </div>

          <div>
            <h3 class="font-bold text-slate-800 mb-2 font-mono text-xs uppercase tracking-wider">Wins</h3>
            <ul class="grid md:grid-cols-3 gap-2 list-disc list-inside text-stone-600 text-sm">
              <li>locality: URL parsing bugs concentrate in one module</li>
              <li>leverage: one interface, multiple ingestion sites</li>
              <li>locality: conforms to CONTEXT.md canonical rules</li>
            </ul>
          </div>
        </article>

        <!-- Candidate 2 -->
        <article class="bg-white border border-stone-200 rounded-xl p-6 shadow-sm space-y-6">
          <div class="flex justify-between items-start flex-wrap gap-4">
            <div>
              <h2 class="text-2xl font-serif font-bold text-slate-900">2. Elevate post reaction (Post Signal) state in the schema</h2>
              <div class="font-mono text-sm text-stone-500 mt-1">
                convex/schema.ts · convex/homeFeed.ts · app/posts/[postId]/reading-view-client.tsx
              </div>
            </div>
            <div class="flex gap-2">
              <span class="bg-emerald-100 text-emerald-800 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-emerald-300">Strong</span>
              <span class="bg-slate-100 text-slate-800 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-slate-300">in-process</span>
            </div>
          </div>

          <!-- Before/After -->
          <div class="grid md:grid-cols-2 gap-6">
            <div class="border border-stone-150 rounded-lg p-4 bg-stone-50">
              <div class="text-xs uppercase tracking-wider text-stone-400 font-bold mb-2">Before: Mismatched schema field (likedAt)</div>
              <pre class="mermaid bg-stone-50">
                flowchart TD
                  classDef leak stroke:#dc2626,stroke-width:2px;
                  UI[reading-view-client.tsx] -->|"feedback: 'like' | 'dislike'"| LS[Local React State]
                  LS -.->|Dislike is a no-op| Schema["schema.ts&lt;br&gt;(likedAt: timestamp)"]
                  class Schema leak
              </pre>
            </div>
            <div class="border border-stone-150 rounded-lg p-4 bg-stone-50">
              <div class="text-xs uppercase tracking-wider text-stone-400 font-bold mb-2">After: Unified Post Signal schema and interface</div>
              <pre class="mermaid bg-stone-50">
                flowchart TD
                  classDef deep fill:#0f172a,stroke:#0f172a,color:#fff;
                  UI[reading-view-client.tsx] -->|"Post Signal: 'like' | 'love' | 'dislike' | 'none'"| Mutation[togglePostSignal mutation]
                  Mutation --> Schema["schema.ts&lt;br&gt;(postSignals table)"]
                  class Mutation deep
              </pre>
            </div>
          </div>

          <div class="grid md:grid-cols-2 gap-6 text-sm">
            <div>
              <h3 class="font-bold text-slate-800">Problem</h3>
              <p class="text-stone-600 mt-1">Domain model mismatch: CONTEXT.md mandates a Post Signal containing multiple reactions (liked, loved, disliked, or none), but the implementation uses a shallow likedAt timestamp in homeFeedItems, leaving Dislike functionally dead.</p>
            </div>
            <div>
              <h3 class="font-bold text-slate-800">Solution</h3>
              <p class="text-stone-600 mt-1">Refactor the schema and interface to store reactions inside a dedicated postSignals module or schema representation, aligning the database structure with the domain glossary.</p>
            </div>
          </div>

          <div>
            <h3 class="font-bold text-slate-800 mb-2 font-mono text-xs uppercase tracking-wider">Wins</h3>
            <ul class="grid md:grid-cols-3 gap-2 list-disc list-inside text-stone-600 text-sm">
              <li>locality: database structure aligns with domain dictionary</li>
              <li>leverage: one reaction interface satisfies all UI states</li>
              <li>locality: database constraints ensure reaction invariants</li>
            </ul>
          </div>
        </article>

        <!-- Candidate 3 -->
        <article class="bg-white border border-stone-200 rounded-xl p-6 shadow-sm space-y-6">
          <div class="flex justify-between items-start flex-wrap gap-4">
            <div>
              <h2 class="text-2xl font-serif font-bold text-slate-900">3. Enforce aggregate lifecycles via home feed item updates</h2>
              <div class="font-mono text-sm text-stone-500 mt-1">
                convex/feedSubscriptions.ts · convex/importWorkflow.ts · convex/homeFeed.ts
              </div>
            </div>
            <div class="flex gap-2">
              <span class="bg-emerald-100 text-emerald-800 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-emerald-300">Strong</span>
              <span class="bg-slate-100 text-slate-800 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-slate-300">in-process</span>
            </div>
          </div>

          <!-- Before/After -->
          <div class="grid md:grid-cols-2 gap-6">
            <div class="border border-stone-150 rounded-lg p-4 bg-stone-50">
              <div class="text-xs uppercase tracking-wider text-stone-400 font-bold mb-2">Before: Direct deletion bypassing aggregate bucket updates</div>
              <pre class="mermaid bg-stone-50">
                flowchart TD
                  classDef leak stroke:#dc2626,stroke-width:2px;
                  Sub[feedSubscriptions.ts] -->|"ctx.db.delete()"| HFI[homeFeedItems]
                  WF[importWorkflow.ts] -->|"ctx.db.delete()"| HFI
                  HFI -.->|Orphaned Index Keys| HFB["homeFeedBuckets component"]
                  class HFB leak
              </pre>
            </div>
            <div class="border border-stone-150 rounded-lg p-4 bg-stone-50">
              <div class="text-xs uppercase tracking-wider text-stone-400 font-bold mb-2">After: Aggregate updates encapsulated in homeFeed module</div>
              <pre class="mermaid bg-stone-50">
                flowchart TD
                  classDef deep fill:#0f172a,stroke:#0f172a,color:#fff;
                  Sub[feedSubscriptions.ts] --> DeleteHFItem
                  WF[importWorkflow.ts] --> DeleteHFItem
                  subgraph homeFeed.ts
                    DeleteHFItem("deleteHomeFeedItem (Deep Seam)")
                  end
                  DeleteHFItem --> HFI[homeFeedItems]
                  DeleteHFItem --> HFB["homeFeedBuckets component"]
                  class DeleteHFItem deep
              </pre>
            </div>
          </div>

          <div class="grid md:grid-cols-2 gap-6 text-sm">
            <div>
              <h3 class="font-bold text-slate-800">Problem</h3>
              <p class="text-stone-600 mt-1">Leakage at the aggregates seam: mutations delete homeFeedItems directly during Unsubscribes or replacement imports, bypassing the aggregate buckets lifecycle, causing orphaned index keys to accumulate in homeFeedBuckets.</p>
            </div>
            <div>
              <h3 class="font-bold text-slate-800">Solution</h3>
              <p class="text-stone-600 mt-1">Move deletion logic inside the homeFeed module, exposing a single deep deletion interface that deletes the item and updates its corresponding aggregates atomically.</p>
            </div>
          </div>

          <div>
            <h3 class="font-bold text-slate-800 mb-2 font-mono text-xs uppercase tracking-wider">Wins</h3>
            <ul class="grid md:grid-cols-3 gap-2 list-disc list-inside text-stone-600 text-sm">
              <li>locality: bucket mutations stay inside the aggregate</li>
              <li>locality: prevents index leakage and orphaned entries</li>
              <li>leverage: centralized lifecycle logic for callers</li>
            </ul>
          </div>
        </article>

        <!-- Candidate 4 -->
        <article class="bg-white border border-stone-200 rounded-xl p-6 shadow-sm space-y-6">
          <div class="flex justify-between items-start flex-wrap gap-4">
            <div>
              <h2 class="text-2xl font-serif font-bold text-slate-900">4. Add feed association to home feed items to resolve read amplification</h2>
              <div class="font-mono text-sm text-stone-500 mt-1">
                convex/schema.ts · convex/feedSubscriptions.ts · convex/importWorkflow.ts
              </div>
            </div>
            <div class="flex gap-2">
              <span class="bg-emerald-100 text-emerald-800 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-emerald-300">Strong</span>
              <span class="bg-slate-100 text-slate-800 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-slate-300">in-process</span>
            </div>
          </div>

          <!-- Before/After -->
          <div class="grid md:grid-cols-2 gap-6">
            <div class="border border-stone-150 rounded-lg p-4 bg-stone-50">
              <div class="text-xs uppercase tracking-wider text-stone-400 font-bold mb-2">Before: Linear database scans over all items</div>
              <pre class="mermaid bg-stone-50">
                flowchart TD
                  classDef leak stroke:#dc2626,stroke-width:2px;
                  Sub[Unsubscribe / Reimport] -->|"Scan All Items O(N)"| HFI[homeFeedItems]
                  HFI -->|Fetch Post| Post[posts]
                  Post -.->|Check feedId| Match{Match?}
                  class HFI leak
              </pre>
            </div>
            <div class="border border-stone-150 rounded-lg p-4 bg-stone-50">
              <div class="text-xs uppercase tracking-wider text-stone-400 font-bold mb-2">After: Direct querying using feedId index</div>
              <pre class="mermaid bg-stone-50">
                flowchart TD
                  classDef deep fill:#0f172a,stroke:#0f172a,color:#fff;
                  Sub[Unsubscribe / Reimport] -->|"Query O(1)"| HFI["homeFeedItems&lt;br&gt;(by_readerId_and_feedId)"]
                  class HFI deep
              </pre>
            </div>
          </div>

          <div class="grid md:grid-cols-2 gap-6 text-sm">
            <div>
              <h3 class="font-bold text-slate-800">Problem</h3>
              <p class="text-stone-600 mt-1">High read amplification: because homeFeedItems has no direct relation to the feed, unsubscribing or reimporting requires a linear database scan over all the reader's items, fetching each post document to verify feed origin.</p>
            </div>
            <div>
              <h3 class="font-bold text-slate-800">Solution</h3>
              <p class="text-stone-600 mt-1">Denormalize the feedId field onto homeFeedItems and add a composite index of by_readerId_and_feedId, allowing direct, efficient queries during deletions.</p>
            </div>
          </div>

          <div>
            <h3 class="font-bold text-slate-800 mb-2 font-mono text-xs uppercase tracking-wider">Wins</h3>
            <ul class="grid md:grid-cols-3 gap-2 list-disc list-inside text-stone-600 text-sm">
              <li>leverage: unsubscribe goes from O(N) reads to O(1) query</li>
              <li>locality: item queries remain in the home feed module</li>
              <li>leverage: eliminates redundant fetch calls during updates</li>
            </ul>
          </div>
        </article>

        <!-- Candidate 5 -->
        <article class="bg-white border border-stone-200 rounded-xl p-6 shadow-sm space-y-6">
          <div class="flex justify-between items-start flex-wrap gap-4">
            <div>
              <h2 class="text-2xl font-serif font-bold text-slate-900">5. Consolidate parsing implementation from feedImports queries</h2>
              <div class="font-mono text-sm text-stone-500 mt-1">
                convex/feedImports.ts · lib/feed-imports.ts
              </div>
            </div>
            <div class="flex gap-2">
              <span class="bg-amber-100 text-amber-800 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-amber-300">Worth exploring</span>
              <span class="bg-slate-100 text-slate-800 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-slate-300">in-process</span>
            </div>
          </div>

          <!-- Before/After -->
          <div class="grid md:grid-cols-2 gap-6">
            <div class="border border-stone-150 rounded-lg p-4 bg-stone-50">
              <div class="text-xs uppercase tracking-wider text-stone-400 font-bold mb-2">Before: Parallel parser implementations</div>
              <pre class="mermaid bg-stone-50">
                flowchart TD
                  classDef leak stroke:#dc2626,stroke-width:2px;
                  convex/feedImports.ts -.->|"Duplicate (200+ LOC)"| parseFeed_Dup["parseFeed(xml)"]
                  lib/feed-imports.ts --> parseFeed_Can["parseFeed(xml)"]
                  class parseFeed_Dup leak
              </pre>
            </div>
            <div class="border border-stone-150 rounded-lg p-4 bg-stone-50">
              <div class="text-xs uppercase tracking-wider text-stone-400 font-bold mb-2">After: Shared parsing library</div>
              <pre class="mermaid bg-stone-50">
                flowchart TD
                  classDef deep fill:#0f172a,stroke:#0f172a,color:#fff;
                  convex/feedImports.ts --> parseFeed_Can["parseFeed(xml)"]
                  lib/feed-imports.ts --> parseFeed_Can
                  class parseFeed_Can deep
              </pre>
            </div>
          </div>

          <div class="grid md:grid-cols-2 gap-6 text-sm">
            <div>
              <h3 class="font-bold text-slate-800">Problem</h3>
              <p class="text-stone-600 mt-1">Dead code duplication: convex/feedImports.ts contains copies of all parsing helpers from lib/feed-imports.ts, but only uses the database querying functions (the local parser code is completely uncalled).</p>
            </div>
            <div>
              <h3 class="font-bold text-slate-800">Solution</h3>
              <p class="text-stone-600 mt-1">Delete the duplicate parsing code from convex/feedImports.ts and import necessary helper methods directly from @/lib/feed-imports.</p>
            </div>
          </div>

          <div>
            <h3 class="font-bold text-slate-800 mb-2 font-mono text-xs uppercase tracking-wider">Wins</h3>
            <ul class="grid md:grid-cols-3 gap-2 list-disc list-inside text-stone-600 text-sm">
              <li>locality: single parser implementation to verify</li>
              <li>leverage: deletes over 200 lines of dead code</li>
            </ul>
          </div>
        </article>

      </section>

      <!-- Top Recommendation -->
      <section id="top-recommendation" class="bg-slate-900 text-white rounded-xl p-8 shadow-md">
        <h2 class="text-3xl font-serif font-black mb-2">Top Recommendation</h2>
        <p class="text-slate-300 text-sm mb-6">
          I recommend tackling <strong class="text-white">Candidate 3 (Enforce aggregate lifecycles via home feed item updates)</strong> first. 
        </p>
        <p class="text-slate-300 text-sm">
          Ensuring that database aggregates (homeFeedBuckets) are consistently updated prevents state pollution and orphaned index keys. Implementing a deep deletion interface inside the home feed module establishes the necessary locality and sets up a robust interface seam for all future mutations that alter the home feed items lifecycle.
        </p>
      </section>
      
    </main>
  </body>
</html>`;

const tmpDir = process.env.TMPDIR || os.tmpdir() || '/tmp';
const filePath = path.join(tmpDir, 'architecture-review-' + Date.now() + '.html');

try {
  fs.writeFileSync(filePath, htmlContent, 'utf8');
  console.log(filePath);
} catch (err) {
  console.error('Error writing report:', err);
  process.exit(1);
}
