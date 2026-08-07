# Temporary removal sitemaps rollout runbook

## Purpose and scope

This runbook controls the staged Google Search Console submission and retirement
of five temporary removal sitemaps. These files exist only to let Google revisit
historically advertised longtail pages and observe their `noindex` metadata.
They must not be added to the permanent sitemap index or `robots.txt`.

Production endpoints:

| Kind | URL | Exact audited baseline |
| --- | --- | ---: |
| Chart | `https://siglens.io/sitemap-removal-chart.xml` | 29,069 |
| News | `https://siglens.io/sitemap-removal-news.xml` | 26,861 |
| Overall | `https://siglens.io/sitemap-removal-overall.xml` | 26,861 |
| Fundamental | `https://siglens.io/sitemap-removal-fundamental.xml` | 26,861 |
| Fear and greed | `https://siglens.io/sitemap-removal-fear-greed.xml` | 26,861 |

These counts are exact audited baselines with no tolerance. Any mismatch pauses
submission. Do not assume that a changed database count is safe. Investigate
the candidate cutoff, protected-symbol exclusion, source ordering, and
deployment version before proceeding.

## Roles and evidence

Assign one rollout owner and one verifier for each stage. Record the deployment
SHA, command output, Search Console status, health-dashboard screenshots, and
the submission time in the release record. The verifier must confirm every
pre-submit gate before the owner submits a file.

## Pre-submit validation

Run these checks against production after deployment and before Day 0. Repeat
the count, protected-list, metadata, and health checks before every later stage.
Run the Bash blocks below in the same Bash session so the timeout constants,
evidence directory, and cleanup trap remain active.

### 1. Fetch and parse every XML file

```bash
set -euo pipefail
CURL_CONNECT_TIMEOUT_SECONDS=5
CURL_MAX_TIME_SECONDS=30
removal_qa_dir=$(mktemp -d)
cleanup_removal_qa() {
  rm -f -- \
    "${removal_qa_dir}/chart.xml" \
    "${removal_qa_dir}/news.xml" \
    "${removal_qa_dir}/overall.xml" \
    "${removal_qa_dir}/fundamental.xml" \
    "${removal_qa_dir}/fear-greed.xml" \
    "${removal_qa_dir}/sitemap.xml" \
    "${removal_qa_dir}/robots.txt"
  rmdir -- "$removal_qa_dir"
}
trap cleanup_removal_qa EXIT

for kind in chart news overall fundamental fear-greed; do
  url="https://siglens.io/sitemap-removal-${kind}.xml"
  output="${removal_qa_dir}/${kind}.xml"
  curl -fsS \
    --connect-timeout "$CURL_CONNECT_TIMEOUT_SECONDS" \
    --max-time "$CURL_MAX_TIME_SECONDS" \
    "$url" \
    --output "$output"
  xmllint --noout "$output"
  count=$(xmllint --xpath 'count(//*[local-name()="url"])' "$output")
  if [ "$kind" = 'chart' ]; then
    expected=29069
  else
    expected=26861
  fi
  if [ "$count" -ne "$expected" ]; then
    printf 'FAIL count %s expected=%s actual=%s\n' "$kind" "$expected" "$count"
    exit 1
  fi
  printf 'PASS count %s %s\n' "$kind" "$count"
done
printf 'Saved validation files in %s\n' "$removal_qa_dir"
```

The exact baseline is 29,069 for chart and 26,861 for each legacy file, with no
tolerance. Each file must parse successfully and remain below the 50,000 URL
limit. A parse failure, HTTP failure, empty or partial file, limit violation, or
any count mismatch is a stop condition.

The rollout owner owns `removal_qa_dir` for the duration of each pre-stage
validation session. Before leaving the shell, the owner copies command output
and required evidence to the release record. The `EXIT` trap then deletes only
the seven named files above and removes that exact `mktemp` directory. Run this
cleanup after every Day 0, 2, 4, 6, and 8 validation session, not while another
verifier is still inspecting the files.

### 2. Prove the permanent sitemap has no removal reference

```bash
permanent_sitemap_file="${removal_qa_dir}/sitemap.xml"
if ! curl -fsS \
  --connect-timeout "$CURL_CONNECT_TIMEOUT_SECONDS" \
  --max-time "$CURL_MAX_TIME_SECONDS" \
  https://siglens.io/sitemap.xml \
  -o "$permanent_sitemap_file"; then
  echo 'FAIL: could not fetch permanent sitemap'
  exit 1
fi
if ! xmllint --noout "$permanent_sitemap_file"; then
  echo 'FAIL: permanent sitemap XML is invalid'
  exit 1
fi

if rg --quiet 'sitemap-removal-' "$permanent_sitemap_file"; then
  permanent_rg_status=0
else
  permanent_rg_status=$?
fi

if [ "$permanent_rg_status" -eq 0 ]; then
  echo 'FAIL: permanent sitemap references a removal sitemap'
  exit 1
elif [ "$permanent_rg_status" -eq 1 ]; then
  echo 'PASS: expected no removal sitemap reference in permanent sitemap'
else
  printf 'FAIL: permanent sitemap reference check failed with rg status %s\n' \
    "$permanent_rg_status"
  exit 1
fi
```

The `rg` no-match status of 1 is expected and is handled by the matching status
branch. Any other nonzero status fails validation. Also confirm `robots.txt`
contains no removal sitemap URL:

```bash
robots_file="${removal_qa_dir}/robots.txt"
if ! curl -fsS \
  --connect-timeout "$CURL_CONNECT_TIMEOUT_SECONDS" \
  --max-time "$CURL_MAX_TIME_SECONDS" \
  https://siglens.io/robots.txt \
  -o "$robots_file"; then
  echo 'FAIL: could not fetch robots.txt'
  exit 1
fi

if rg --quiet 'sitemap-removal-' "$robots_file"; then
  robots_rg_status=0
else
  robots_rg_status=$?
fi

if [ "$robots_rg_status" -eq 0 ]; then
  echo 'FAIL: robots.txt references a removal sitemap'
  exit 1
elif [ "$robots_rg_status" -eq 1 ]; then
  echo 'PASS: expected no removal sitemap reference in robots.txt'
else
  printf 'FAIL: robots.txt reference check failed with rg status %s\n' \
    "$robots_rg_status"
  exit 1
fi
```

### 3. Prove complete protected-list exclusion

This check imports the full current `POPULAR_TICKERS`, `POPULAR_CRYPTOS`, and
`APPROVED_LONGTAIL_TICKERS` arrays. A representative sample is not sufficient.
Run it from the deployed repository revision:

```bash
node_modules/.bin/tsx <<'TS'
import { APPROVED_LONGTAIL_TICKERS } from '@/entities/symbol-indexability';
import { POPULAR_CRYPTOS } from '@/shared/config/popular-cryptos';
import { POPULAR_TICKERS } from '@/shared/config/popular-tickers';
import { Agent, fetch } from 'undici';

const kinds = ['chart', 'news', 'overall', 'fundamental', 'fear-greed'] as const;
const expectedCounts = {
  chart: 29_069,
  news: 26_861,
  overall: 26_861,
  fundamental: 26_861,
  'fear-greed': 26_861,
} as const;
const CONNECT_TIMEOUT_MS = 5_000;
const OVERALL_TIMEOUT_MS = 30_000;
const dispatcher = new Agent({ connect: { timeout: CONNECT_TIMEOUT_MS } });
const protectedSymbols = new Set([
  ...POPULAR_TICKERS,
  ...POPULAR_CRYPTOS,
  ...APPROVED_LONGTAIL_TICKERS,
].map(symbol => symbol.toUpperCase()));

try {
  const documents = await Promise.all(kinds.map(async kind => {
    const url = `https://siglens.io/sitemap-removal-${kind}.xml`;
    const response = await fetch(url, {
      dispatcher,
      signal: AbortSignal.timeout(OVERALL_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`${url} returned ${response.status}`);
    const xml = await response.text();
    const locations = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
      .map(match => match[1]!);
    if (locations.length !== expectedCounts[kind]) {
      throw new Error(
        `${kind} count mismatch: expected ${expectedCounts[kind]}, got ${locations.length}`
      );
    }
    console.log(`PASS count ${kind} ${locations.length}`);
    return [kind, locations] as const;
  }));

  const violations = documents.flatMap(([kind, locations]) =>
    locations
      .map(location => new URL(location).pathname.split('/')[1]!.toUpperCase())
      .filter(symbol => protectedSymbols.has(symbol))
      .map(symbol => `${kind}:${symbol}`)
  );

  if (violations.length > 0) {
    throw new Error(`protected symbols found: ${violations.join(', ')}`);
  }

  console.log(`PASS: ${protectedSymbols.size} protected symbols absent from all files`);
} finally {
  await dispatcher.close();
}
TS
```

The zero-intersection result is valid only after every extracted `<loc>` count
matches its exact audited baseline. Any count mismatch or protected-symbol
intersection pauses the rollout immediately.

### 4. Confirm representative Googlebot `noindex`

Check three removal URLs from each file, including the first, middle, and last
entries. Fetch each URL with the Googlebot user agent and inspect the rendered
metadata:

```bash
node_modules/.bin/tsx <<'TS'
import { Agent, fetch } from 'undici';

const kinds = ['chart', 'news', 'overall', 'fundamental', 'fear-greed'] as const;
const CONNECT_TIMEOUT_MS = 5_000;
const OVERALL_TIMEOUT_MS = 30_000;
const dispatcher = new Agent({ connect: { timeout: CONNECT_TIMEOUT_MS } });

try {
  for (const kind of kinds) {
    const sitemapUrl = `https://siglens.io/sitemap-removal-${kind}.xml`;
    const sitemapResponse = await fetch(sitemapUrl, {
      dispatcher,
      signal: AbortSignal.timeout(OVERALL_TIMEOUT_MS),
    });
    if (!sitemapResponse.ok) {
      throw new Error(`${sitemapUrl} returned ${sitemapResponse.status}`);
    }

    const xml = await sitemapResponse.text();
    const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
      .map(match => match[1]!);
    if (urls.length === 0) throw new Error(`${kind} has no URLs`);

    const sampleIndexes = [0, Math.floor(urls.length / 2), urls.length - 1];
    for (const sampleIndex of sampleIndexes) {
      const pageUrl = urls[sampleIndex]!;
      const pageResponse = await fetch(pageUrl, {
        dispatcher,
        headers: { 'User-Agent': 'Googlebot' },
        signal: AbortSignal.timeout(OVERALL_TIMEOUT_MS),
      });
      if (!pageResponse.ok) {
        throw new Error(`${pageUrl} returned ${pageResponse.status}`);
      }

      const html = await pageResponse.text();
      const robotsMeta = [...html.matchAll(/<meta\b[^>]*>/gi)]
        .map(match => match[0])
        .find(tag => /\bname=["']?robots["']?/i.test(tag));
      if (!robotsMeta || !/noindex/i.test(robotsMeta)) {
        throw new Error(`Googlebot noindex missing: ${pageUrl}`);
      }
      console.log(`PASS noindex ${pageUrl}`);
    }
  }
} finally {
  await dispatcher.close();
}
TS
```

Save the exact sample set printed by the command in the release record.

### 5. Confirm retained popular pages remain indexable

The minimum retained-page sample is six URLs: three popular stocks and three
popular cryptocurrencies. These exact representatives are present in the
current protected lists:

```text
https://siglens.io/AAPL
https://siglens.io/MSFT
https://siglens.io/NVDA
https://siglens.io/BTCUSD
https://siglens.io/ETHUSD
https://siglens.io/SOLUSD
```

Each URL must return exactly HTTP 200 to Googlebot and must have no robots meta
tag containing `noindex`. Run this reproducible gate:

```bash
node_modules/.bin/tsx <<'TS'
import { Agent, fetch } from 'undici';

const retainedUrls = [
  'https://siglens.io/AAPL',
  'https://siglens.io/MSFT',
  'https://siglens.io/NVDA',
  'https://siglens.io/BTCUSD',
  'https://siglens.io/ETHUSD',
  'https://siglens.io/SOLUSD',
] as const;
const MINIMUM_RETAINED_SAMPLES = 6;
const CONNECT_TIMEOUT_MS = 5_000;
const OVERALL_TIMEOUT_MS = 30_000;
const dispatcher = new Agent({ connect: { timeout: CONNECT_TIMEOUT_MS } });

if (retainedUrls.length < MINIMUM_RETAINED_SAMPLES) {
  throw new Error(`retained sample count below ${MINIMUM_RETAINED_SAMPLES}`);
}

try {
  for (const pageUrl of retainedUrls) {
    const response = await fetch(pageUrl, {
      dispatcher,
      headers: { 'User-Agent': 'Googlebot' },
      signal: AbortSignal.timeout(OVERALL_TIMEOUT_MS),
    });
    if (response.status !== 200) {
      throw new Error(`${pageUrl} returned ${response.status}, expected 200`);
    }

    const html = await response.text();
    const robotsTags = [...html.matchAll(/<meta\b[^>]*>/gi)]
      .map(match => match[0])
      .filter(tag => /\bname=["']?robots["']?/i.test(tag));
    if (robotsTags.some(tag => /noindex/i.test(tag))) {
      throw new Error(`Googlebot noindex found on retained page: ${pageUrl}`);
    }
    console.log(`PASS indexable 200 ${pageUrl}`);
  }
} finally {
  await dispatcher.close();
}
TS
```

Any non-200 response, timeout, connection failure, or `noindex` result pauses
the rollout.

### 6. Confirm production health

Use the production dashboards and logs over the same comparison window used by
normal releases. Confirm all of the following before any submission:

- Core pages and all five sitemap endpoints return successful responses.
- Application and ALB 5xx rates have not materially increased.
- ALB target response time and application latency have not materially
  increased, including p95 and p99.
- Database error rate, connection pressure, and query latency are normal.
- ISR cache errors, failed writes, fail-open events, and cache-handler alarms
  are normal.
- No new deployment alarm, saturation signal, or Googlebot traffic spike is
  active.

Record the baseline window and current values. A judgment such as "looks fine"
without recorded evidence does not satisfy this gate.

## Submission schedule and stage gates

Use the exact schedule below. Day numbers are measured from the successful
chart submission in Search Console.

| Day | Submit in Google Search Console | Exact audited baseline |
| ---: | --- | ---: |
| 0 | `sitemap-removal-chart.xml` | 29,069 |
| 2 | `sitemap-removal-news.xml` | 26,861 |
| 4 | `sitemap-removal-overall.xml` | 26,861 |
| 6 | `sitemap-removal-fundamental.xml` | 26,861 |
| 8 | `sitemap-removal-fear-greed.xml` | 26,861 |

Before each stage, including Day 0, rerun XML parsing and exact count validation
for all five files, then complete the protected-list, representative Googlebot
`noindex`, retained-page indexability, and production-health checks. Before
Days 2, 4, 6, and 8, Search Console must additionally report the immediately
preceding submitted sitemap as successful. Do not advance based only on elapsed
time.

For every stage:

1. Capture the prior Search Console sitemap status. For Day 0, record that no
   prior removal sitemap exists.
2. Re-run XML parsing and exact count validation for all five files. Each stage
   requires chart 29,069 and each legacy file 26,861 with no tolerance.
3. Re-run complete protected-list exclusion across all five files.
4. Re-check the first, middle, and last Googlebot `noindex` samples for all five
   files.
5. Re-run the six-URL retained-page indexability gate.
6. Re-check 5xx, latency, database, and ISR/cache health.
7. Submit only the scheduled filename in Search Console.
8. Capture the submission timestamp and initial fetch result.

## Pause and rollback conditions

Pause the current stage and all later submissions if any of these conditions
occur:

- Search Console does not report the prior sitemap as successful.
- Any of the five XML files fails HTTP retrieval or XML parsing, is partial,
  exceeds 50,000 URLs, or differs from its exact audited baseline.
- Any protected stock, crypto, or approved longtail symbol appears in a removal
  sitemap.
- Any representative removal URL loses Googlebot-visible `noindex`.
- Any of the six retained popular samples returns a status other than 200 or
  exposes `noindex` to Googlebot.
- Application or ALB 5xx, latency, database errors or pressure, ISR/cache
  failures, fail-open activity, or origin saturation materially regress.
- Googlebot traffic creates unexpected load or an operational alarm fires.
- The deployed SHA or generated file changes without a completed revalidation.

Do not delete already submitted files as an immediate reaction unless incident
response requires it. Stop new submissions, preserve evidence, identify the
cause, and follow the normal deployment rollback procedure when the application
change is responsible. Resume only after the failed gate is corrected and the
entire pre-submit validation passes again.

## Monitoring

During Days 0 through 8, check and record daily:

- Search Console fetch status and discovered URL count for every submitted
  sitemap.
- Googlebot request volume and response distribution for removal URLs.
- Application and ALB 5xx rates, p95 and p99 latency, and target health.
- Database failures, connection pressure, and query latency.
- ISR/cache failures, failed writes, fail-open events, and alarms.
- Googlebot-visible `noindex` on the recorded representative URLs.

After Day 8, check weekly:

- Indexed URL count filtered by each submitted sitemap.
- `Excluded by noindex` movement and any unexpected crawl anomaly.
- Impressions and average position for retained popular stock and crypto pages.
- Production health trends associated with Googlebot recrawling.

Search Console fetch success is only the start signal. It is not evidence that
all submitted URLs have left the index.

## Completion and cleanup

The rollout is complete only when Search Console reports zero indexed URLs for
every submitted sitemap across two consecutive weekly checks. Both checks must
cover all five files, be at least one week apart, and be recorded. A zero count
for only some files or only one weekly check is not completion.

After the completion criterion is met:

1. Remove all five temporary sitemap submissions from Search Console.
2. Deploy the follow-up cleanup that removes the temporary DB loaders and XML
   generation while retaining explicit `410 Gone` responses for all five
   retired filenames.
3. Keep the five `410` routes active for exactly 14 calendar days starting at
   the recorded Search Console removal time. Check daily that all five return
   `410`, removal-filename traffic is stable or declining, no internal or
   permanent-sitemap reference has reappeared, and 5xx, latency, database, and
   ISR/cache health remain normal.
4. Exit the observation period only after all 14 daily checks are recorded and
   the Day 14 check passes every criterion in step 3. Any failed or missing
   daily check pauses the clock until the condition is investigated and a new
   complete 14-day window is recorded.
5. After the exit criterion passes, deploy the final cleanup that removes the
   five `410` routes and their rewrites. Confirm the retired filenames are no
   longer routed by the application, record final crawler and health evidence,
   and close the release record.
