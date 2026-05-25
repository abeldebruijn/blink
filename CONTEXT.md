# Blink

Blink is a social reading context for discovering, summarizing, and organizing posts from subscribed publication feeds.

## Language

**Feed**:
The canonical source URL for an RSS or Atom publication.
_Avoid_: RSS feed subscription, blog source

**Submitted Feed URL**:
The URL a Reader enters when attempting to subscribe to a Feed.
_Avoid_: Feed URL, source URL

**Feed Subscription**:
A user's relationship to a Feed they follow.
_Avoid_: Feed, subscription

**Unsubscribe**:
A Reader's removal of their Feed Subscription.
_Avoid_: Delete feed, remove posts

**Reader**:
An authenticated person using Blink to follow Feeds and organize Posts.
_Avoid_: User, account

**Reader Profile**:
The Reader's explicit interests used to personalize Post abstracts.
_Avoid_: Preferences, personalization settings

**Reader Interest**:
An explicit free-text or Tag-based interest in a Reader Profile.
_Avoid_: Inferred interest, preference signal

**Post**:
A single article or entry discovered from a Feed.
_Avoid_: Blog, blog post, feed item

**Post Source**:
A Feed occurrence that referenced a Post.
_Avoid_: Owning feed, source

**Post Author**:
The person, company, or publication byline credited for a Post when reliably available.
_Avoid_: Author, source

**Abstract**:
A short shared Post summary with an opener, general interest rationale, and conclusion.
_Avoid_: Summary, TLDR

**Personal Note**:
A Reader-specific explanation of why a Post may be interesting to that Reader.
_Avoid_: Personalized abstract, recommendation blurb

**Post Signal**:
A Reader's reaction to one Post.
_Avoid_: Reaction, rating

**Read State**:
A Reader's unread or read state for a Post.
_Avoid_: Progress, reading history

**Read Later**:
A Reader's private saved-for-later state for a Post.
_Avoid_: Bookmark, saved post, favorite

**Tag**:
A Reader-owned label used to organize Home Feed Items.
_Avoid_: Topic, shared topic, category

**Tag Description**:
Internal text describing what a Tag means for future automatic tagging.
_Avoid_: Public tag description, tag copy

**Home Feed**:
The Reader's primary list of Posts from their Feed Subscriptions.
_Avoid_: Global feed, discovery feed

**Home Feed Item**:
A Reader-specific inclusion of one Post in the Reader's Home Feed.
_Avoid_: Feed row, timeline entry, computed post

**Reading View**:
The in-app view that shows a Post's Extracted Content.
_Avoid_: Article page, reader mode

**Canonical Article URL**:
The stable article URL that identifies one Post across feeds and users.
_Avoid_: GUID, feed item ID, link

**Canonical Feed URL**:
The stable RSS or Atom URL that identifies one Feed.
_Avoid_: Feed link, submitted URL

**Extracted Content**:
The readable text captured from a Post's Canonical Article URL.
_Avoid_: Full post, article body, scrape, HTML

**Header Image**:
A remote image URL selected to preview a Post.
_Avoid_: Header photo, stored image, thumbnail

**Initial Import**:
The first capture of the newest available Posts listed directly by a Feed when a user subscribes.
_Avoid_: Backfill, archive crawl

**Daily Refresh**:
The future scheduled check that imports newly listed Posts from existing Feeds.
_Avoid_: Reprocess, backfill

**Manual Refresh**:
A Reader-triggered check that imports newly listed Posts from one existing Feed Subscription.
_Avoid_: Resync, reprocess, backfill

## Relationships

- A **Feed** can have many **Feed Subscriptions**
- A **Submitted Feed URL** resolves to one **Feed** or a validation error
- A **Feed Subscription** belongs to exactly one **Feed** and one **Reader**
- An **Unsubscribe** removes or deactivates one **Feed Subscription**
- An **Initial Import** is shared for a **Feed**, not repeated per **Feed Subscription**
- A **Reader** has at most one **Reader Profile**
- A **Reader Profile** can have many **Reader Interests**
- A **Post** can have many **Post Sources**
- A **Post Source** belongs to exactly one **Post** and one **Feed**
- **Feed Metadata** belongs to a **Feed** or **Post Source**
- **Extracted Metadata** belongs to one **Post**
- A **Post** can have one **Post Author**
- A **Post** is identified by one **Canonical Article URL**
- A **Feed** is identified by one **Canonical Feed URL**
- An **Importing Post** becomes a readable **Post** or an **Extraction Failed Post**
- **Extracted Content** belongs to exactly one **Post**
- A **Post** can have one **Header Image**
- An **Abstract** belongs to exactly one **Post**
- A **Personal Note** belongs to exactly one **Reader** and one **Post**
- An **Abstract Failed Post** remains readable through its **Extracted Content**
- A **Post Signal** belongs to exactly one **Reader** and one **Post**
- An **Author Hide** belongs to exactly one **Reader**
- **Read Later** belongs to exactly one **Reader** and one **Post**
- **Read State** belongs to exactly one **Reader** and one **Post**
- A **Reader** can have many **Tags**
- A **Tag** belongs to exactly one **Reader**
- A **Home Feed Item** can have many **Tags**
- A **Home Feed** shows **Posts** from a **Reader's** own **Feed Subscriptions**
- A **Home Feed Item** belongs to exactly one **Reader** and one **Post**
- A **Reading View** shows one **Post's Extracted Content**
- An **Original Article Action** opens one **Canonical Article URL**
- A **Displayed Source** is selected from a **Reader's** subscribed **Post Sources**
- A **Feed Drawer** shows a **Reader's Feed Subscriptions**
- **Social Discovery** is outside v1 scope

## Example dialogue

> **Dev:** "If two users subscribe to the same **Feed**, do we store duplicate **Posts**?"
> **Domain expert:** "No — the **Feed** and **Posts** are shared, while each user's **Feed Subscription** and reactions are personal."

## Flagged ambiguities

- "RSS feed" was used to mean both the source and the user's subscription — resolved: **Feed** is the source, **Feed Subscription** is the user's relationship to it.
- "currently provided" means the newest entries listed directly in the Feed during the **Initial Import**, capped at 20 **Posts**.
- A **Daily Refresh** imports new **Posts** only; reprocessing old Posts is a separate manual or admin operation.
- The **MVP** excludes **Daily Refresh**, **Social Discovery**, advanced ranking, Feed mute, public Blink pages, and full reprocessing UI.
- **Import Status** is visible at Feed and Post level, but detailed job logs are outside v1 scope.
- "post identity" is the **Canonical Article URL**; feed GUIDs are source metadata, not identity.
- Multiple **Feeds** can reference the same **Post** through **Post Sources**.
- A **Displayed Source** is the most recent **Post Source** from the Reader's subscribed **Feeds**.
- "me" in an **Abstract** means the authenticated **Reader**, using explicit **Reader Profile** interests; if no interests exist, personal relevance is omitted.
- In v1, Blink is authenticated-first; there is no anonymous Reader experience.
- In v1, **Reader Interests** are explicit and editable; **Post Signals** do not infer or mutate them.
- "reaction" was too broad — resolved: **Post Signal**, **Topic Hide**, and **Author Hide** are separate concepts.
- A **Reader** has at most one current **Post Signal** per **Post**: liked, loved, disliked, or none.
- **Post Signal**, **Topic Hide**, and **Author Hide** are independent; a Reader can love a **Post** while hiding future Posts from its **Post Author** or **Feed**.
- **Topic Hide** and **Author Hide** suppress matching Posts from the default **Home Feed** immediately without deleting Posts or Reader data.
- **Read Later** does not remove a **Post** from the **Home Feed**.
- **Read State** is unread or read only in v1; Blink does not track reading progress.
- In v1, the **Home Feed** sorts by **Published Time** when available, then **Discovered Time**.
- The **Reading View** shows extracted text only and must keep an **Original Article Action** persistently available.
- Links inside **Extracted Content** remain clickable and open externally; Blink does not crawl linked pages in v1.
- **Author Hide** targets the **Post Author** when known, otherwise the **Feed**.
- **Importing Posts** and **Extraction Failed Posts** remain visible on the home page.
- A **Manual Refresh** imports new **Posts** only; it does not reprocess old Posts.
- **Extracted Content** comes from Firecrawl reading the **Canonical Article URL** for each discovered **Post**.
- RSS or Atom entry content is discovery and fallback metadata; Blink does not summarize only the feed description when page content can be extracted.
- **Extracted Content** stores text only; images are referenced from their original servers rather than copied.
- **Extracted Content** is stored as markdown text.
- **Abstracts** require **Extracted Content**; feed summaries are not enough.
- A **Header Image** stores a remote URL only; selection priority is article social image, extracted top image, Feed image, then no image.
- An **Abstract** is shared for a **Post**; the **Personal Note** carries Reader-specific relevance.
- **Personal Notes** are generated lazily when a **Post** appears for a **Reader** with **Reader Interests**.
- Changing **Reader Interests** does not immediately regenerate all historical **Personal Notes**.
- **Extraction Failed Post**, **Abstract Failed Post**, and **Personal Note Unavailable** are separate states.
- In v1, the **Home Feed** is limited to a Reader's own **Feed Subscriptions**; broader social discovery is intentionally left open.
- "social platform" means **Social Discovery** later; v1 has no Reader following, public profiles, or shared activity feed.
- In v1, **Share** means sharing the original **Canonical Article URL**, not a public Blink summary page.
- Subscribing to an already-imported **Feed** reuses existing **Posts** unless the **Feed** is missing import state or stale.
- **Unsubscribe** does not delete shared **Feeds**, **Posts**, **Extracted Content**, **Abstracts**.
- A **Submitted Feed URL** may be an RSS/Atom URL or an HTML page with discoverable feed metadata; the stored **Feed** uses the resolved RSS/Atom URL.
- **Canonical Article URLs** and **Canonical Feed URLs** use conservative normalization: lowercase scheme and host, remove fragments and common tracking parameters, preserve identity-bearing path and query details.
- Blink stores **Feed Metadata** and **Extracted Metadata** separately; display fields prefer confident extracted values, then feed-provided values.
- In v1, **Feed Subscriptions** are binary; there is no paused or muted Feed Subscription state.
