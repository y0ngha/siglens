# Temporary removal sitemaps design

## 1. Goal

Reintroduce the URLs formerly advertised by the retired longtail sitemaps as
temporary, removal-only sitemaps. The temporary files let Google revisit those
pages and observe the `noindex` metadata deployed on 2026-07-08 without adding
the URLs back to the site's normal sitemap policy.

The rollout is staged over roughly eight days so Googlebot traffic, ISR writes,
and origin health can be checked between route groups.

## 2. Constraints

- `POPULAR_TICKERS` and every route generated for those symbols remain in the
  normal sitemap and must never appear in a removal sitemap.
- `POPULAR_CRYPTOS` and every route generated for those symbols remain in the
  normal sitemap and must never appear in a removal sitemap.
- `APPROVED_LONGTAIL_TICKERS` is also protected so a future curated longtail
  addition cannot be accidentally submitted for removal.
- The normal `/sitemap.xml`, `robots.txt`, `sitemap-static.xml`,
  `sitemap-popular.xml`, and `sitemap-crypto.xml` behavior does not change.
- Removal sitemap routes are temporary operational tools. They are not linked
  from the normal sitemap index or `robots.txt` and are submitted manually in
  Search Console.
- A removal sitemap contains at most 50,000 URLs and uses absolute canonical
  URL spelling.
- The database access is read-only. No migration or data mutation is required.

## 3. Historical source of truth

The longtail sitemap policy changed in three relevant commits:

| Period | Commit | Advertised longtail routes |
| --- | --- | --- |
| 2026-05-26 to 2026-06-15 | `697ef86d`, `d2b119a9` | chart, news, fundamental, overall, fear-greed |
| 2026-06-15 to 2026-07-08 | `e5930b42` | chart only |
| From 2026-07-08 | `e9962079`, `b5470343` | none; longtail pages use the central `noindex` gate |

The former equity source queried `korean_tickers` and excluded only popular
stock symbols. The former crypto source selected up to 1,000 non-popular crypto
symbols ordered by circulating supply.

The current schema has no immutable `created_at` column for `korean_tickers`.
`updated_at` is therefore the best available reconstruction boundary, but it is
not a perfect historical ledger because an upsert can move an old row forward.
This limitation is preferable to submitting every current DB row, which would
deliberately disclose post-retirement URLs Google may never have seen.

## 4. Candidate sets

### 4.1 Protected symbols

Build one normalized protected set from:

```text
POPULAR_TICKERS
POPULAR_CRYPTOS
APPROVED_LONGTAIL_TICKERS
```

Every candidate loader applies this exclusion before pagination and XML
generation. Route tests also assert that representative and complete protected
sets have zero intersection with generated URLs.

### 4.2 Chart candidates

The chart removal sitemap combines and deduplicates:

1. `korean_tickers` symbols with
   `updated_at < 2026-07-08T01:25:18+09:00`, excluding protected symbols.
2. The first 1,000 `crypto_assets` symbols using the former historical order:
   `circulating_supply DESC NULLS LAST, symbol ASC`, excluding protected symbols.

The cutoff uses the commit that completed the cross-tab indexability review,
not the earlier partial commit 30 minutes before it.

The 2026-08-07 production read-only audit produced:

```text
korean_tickers candidates       28,507
crypto top-N candidates          1,000
overlap                            438
unique chart URLs               29,069
```

### 4.3 Legacy tab candidates

Each legacy tab sitemap selects `korean_tickers` symbols with
`updated_at < 2026-06-15T17:36:58+09:00`, excluding protected symbols. This is
the point at which longtail sitemap expansion changed from five routes to chart
only.

The 2026-08-07 production read-only audit produced 26,861 symbols per legacy
route:

```text
/{symbol}/news
/{symbol}/overall
/{symbol}/fundamental
/{symbol}/fear-greed
```

The reconstructed maximum is 136,513 unique removal URLs. Search Console may
show fewer indexed URLs because sitemap inclusion never guaranteed crawl or
indexing.

## 5. Public routes

Expose five root-level XML files through Next.js rewrites:

```text
/sitemap-removal-chart.xml
/sitemap-removal-news.xml
/sitemap-removal-overall.xml
/sitemap-removal-fundamental.xml
/sitemap-removal-fear-greed.xml
```

There is intentionally no removal sitemap index. Individual files must be
submitted separately so rollout timing, Search Console reporting, and rollback
remain independent for each route group.

Each successful response contains only:

```xml
<url>
  <loc>https://siglens.io/{path}</loc>
  <lastmod>2026-07-08</lastmod>
</url>
```

`priority` and `changefreq` are omitted. The fixed `lastmod` records the real
policy change instead of falsely claiming that the retired pages changed on
every sitemap fetch.

## 6. Application structure

The temporary implementation stays inside the existing sitemap entity and app
route boundaries:

```text
src/entities/sitemap-entry/
  model.ts
  server.ts
  api.ts
  lib/buildRemovalEntries.ts
  lib/loadRemovalCandidates.ts
  lib/removalXml.ts
  __tests__/

src/app/api/sitemap/removal/[kind]/
  route.ts

src/app/api/sitemap/__tests__/
  removal.test.ts
```

Responsibilities:

- The DB adapter selects symbols with a cutoff, deterministic ordering, and
  protected-symbol exclusion.
- The candidate loader combines and deduplicates chart sources and maps each
  removal kind to its path suffix.
- The XML serializer emits the minimal removal XML format and escapes URLs.
- The route validates the removal kind, loads the cached candidate set, checks
  the 50,000 URL cap, and returns XML.
- `next.config.ts` exposes stable root-level filenames for Search Console.

The production barrel must not expose DB-backed modules to client bundles.
Database exports stay behind `server.ts` or an equivalent server-only boundary.

## 7. Caching and failure behavior

Candidate loads use a versioned, non-expiring application cache for the life of
the deployment. This freezes each staged sitemap after its first successful DB
read and avoids repeated production DB work when Google refetches it.

The cache key includes:

```text
temporary-removal-sitemap:v1:{kind}:{cutoff}
```

Responses use the existing sitemap CDN cache policy. A successful XML response
is cacheable. A database or serialization failure returns `503` with
`Retry-After` and never returns a partial sitemap. An unknown removal kind
returns `404`.

The endpoint logs the kind and final URL count, but never logs the database URL
or the complete symbol list.

## 8. Rollout

Before the first submission:

1. Deploy all five files.
2. Validate XML and URL counts in production.
3. Confirm representative removal URLs return `noindex`.
4. Confirm representative popular stock and crypto URLs remain indexable and
   are absent from every removal sitemap.

Submission schedule:

| Day | Search Console submission | Expected URLs |
| --- | --- | ---: |
| 0 | `sitemap-removal-chart.xml` | about 29,069 |
| 2 | `sitemap-removal-news.xml` | about 26,861 |
| 4 | `sitemap-removal-overall.xml` | about 26,861 |
| 6 | `sitemap-removal-fundamental.xml` | about 26,861 |
| 8 | `sitemap-removal-fear-greed.xml` | about 26,861 |

Before every later submission, verify:

- The previous sitemap status in Search Console is successful.
- Representative submitted pages still expose `noindex` to Googlebot.
- Application 5xx rate, ALB latency, database errors, and ISR/cache errors have
  not materially increased.
- The new sitemap still has zero protected-symbol intersections.

Pause the rollout if a sitemap fails to parse, a protected URL is found, a
representative URL loses `noindex`, or production health regresses.

## 9. Monitoring and completion

Search Console sitemap fetch success is only the start signal. Recrawl and
index removal can continue for several weeks.

Monitor:

- Daily during the eight-day rollout: sitemap fetch status, Googlebot traffic,
  5xx rate, latency, DB failures, and representative metadata.
- Weekly after rollout: indexed-page counts filtered by each submitted sitemap,
  `Excluded by noindex` movement, impressions, and average position for the
  retained popular pages.

The normal high-quality sitemap remains the only permanent sitemap. Removal
sitemaps stay available until Search Console reports zero indexed URLs for each
submitted sitemap across two consecutive weekly checks. At that point:

1. Remove each temporary sitemap from Search Console.
2. Deploy a cleanup that removes the DB loaders and rewrites.
3. Return `410 Gone` from the five retired filenames for a short observation
   period, matching the existing longtail sitemap retirement behavior.

## 10. Verification

Unit tests cover:

- Both historical cutoffs.
- Exclusion of every protected stock, crypto, and approved longtail symbol.
- Chart-source deduplication.
- Deterministic symbol ordering.
- Route suffix mapping.
- XML escaping and fixed `lastmod`.
- 50,000 URL cap enforcement.
- DB failure to `503` behavior.
- Invalid kind to `404` behavior.

Route and production checks cover:

```bash
curl -sS https://siglens.io/sitemap-removal-chart.xml | xmllint --noout -
curl -sS https://siglens.io/sitemap-removal-news.xml | xmllint --noout -
curl -sS https://siglens.io/sitemap-removal-overall.xml | xmllint --noout -
curl -sS https://siglens.io/sitemap-removal-fundamental.xml | xmllint --noout -
curl -sS https://siglens.io/sitemap-removal-fear-greed.xml | xmllint --noout -
```

Automated tests must compare generated symbols against the full protected sets,
not a small sample. Production verification also checks final `<url>` counts
against the audited estimates and confirms every file remains under the
sitemap.org limit.

## 11. Non-goals

- Changing which popular stock or crypto pages are indexable.
- Adding removal files to the permanent sitemap index or `robots.txt`.
- Using Search Console's temporary removal API or prefix removal.
- Rebuilding the historical sitemap from all current DB rows without cutoffs.
- Changing page content, ISR cadence, or the central symbol indexability gate.
- Creating a permanent sitemap for unapproved longtail pages.

## 12. External references

- Google Search Central, Build and submit a sitemap:
  <https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap>
- Search Console Help, Sitemaps report:
  <https://support.google.com/webmasters/answer/7451001?hl=en>
- Search Console Help, Removals and SafeSearch reports tool:
  <https://support.google.com/webmasters/answer/9689846?hl=en>
