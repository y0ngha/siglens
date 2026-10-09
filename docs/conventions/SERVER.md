# Server Conventions

Server-side rules for Server Actions, route handlers, I/O, concurrency, the server data cache and the database. General coding rules live in [`CONVENTIONS.md`](CONVENTIONS.md), client rules in [`REACT.md`](REACT.md).

## Rule IDs

Rules that are cited from code comments, reviews, or other docs carry a stable ID in the form `PREFIX-N`,
with an explicit anchor line directly above the heading. Cite them as `SERVER.md#SA-1`.
IDs are never renumbered or reused; a new rule takes the highest existing number of its prefix + 1.
If a rule is deleted, delete its references in the same change.
`src/__tests__/guards/ruleReferences.test.ts` fails on any reference that does not resolve to an anchor.

| Prefix | Topic |
|---|---|
| `SA` | Server Actions, Route Handlers & I/O boundaries |
| `CC` | Concurrency, batching & background work |
| `DC` | Server data cache |
| `DB` | Database & migrations |

---

## HTTP Status Codes

```typescript
// ✅ Use built-in node:http2 constants — no external packages needed
import { constants } from 'node:http2';
const { HTTP_STATUS_BAD_REQUEST, HTTP_STATUS_NOT_FOUND } = constants;

// ❌ No local constant redefinition — node:http2 already provides standard constants
const HTTP_STATUS = { BAD_REQUEST: 400 };

// ❌ No hardcoded literals
return NextResponse.json({ error: '...' }, { status: 400 });
```

---

## Server Actions, Route Handlers & I/O Boundaries

Rules for code that sits on a trust or failure boundary: Server Actions (`entities/<x>/actions/`),
route handlers, adapters and anything else that talks to a DB, a provider or the network.

### Errors

<a id="SA-1"></a>

#### SA-1 — Server Actions never throw to the client

Wrap the whole action body in `try/catch` and return a typed error result (`{ ok: false, error: 'server_error' }`
or the slice's own error shape). An uncaught throw (DB failure, provider timeout, unknown id) reaches the client as
a 500 and breaks the calling hook. This holds for every action, including ones that look pure or file-backed.

```typescript
// ❌ getProviderForModel() throws on an unknown model id
export async function chatAction(input: ChatInput): Promise<ChatResult> {
    return getProviderForModel(input.model);
}

// ✅
export async function chatAction(input: ChatInput): Promise<ChatResult | { ok: false; error: string }> {
    try {
        return getProviderForModel(input.model);
    } catch (e) {
        return { ok: false, error: 'server_error' };
    }
}
```

<a id="SA-2"></a>

#### SA-2 — Wrap every boundary I/O in try/catch

DB queries, provider calls, auth/session reads and `response.json()` parsing can all throw. When one I/O call in a
module is protected, every I/O call at the same call depth must be protected the same way; return the error
result instead of letting the exception propagate. Log before returning (see SA-4).

```typescript
// ❌ sibling actions protect getCurrentUser(), this one does not; json() can throw SyntaxError
const user = getCurrentUser();
const payload = await response.json();

// ✅
try {
    const payload = await response.json();
} catch (e) {
    console.error('[parseOAuthResponse]', e);
    return { ok: false, error: 'parse_error' };
}
```

<a id="SA-3"></a>

#### SA-3 — Keep the exception-safety scope when refactoring

If code declares a containment invariant ("X failing must not break Y"), the `try/catch` must cover the whole
guarded operation including setup (client construction, report building, initialization). Extracting a helper or
hook and leaving the construction outside the `try` silently turns a contained failure into an uncaught one.

```typescript
// ❌ getDatabaseClient() can throw and bypasses containment
const client = getDatabaseClient();
try { repo.recordVisit(client); } catch { return log_and_204; }

// ✅ construction stays inside the guarded block
try { repo.recordVisit(getDatabaseClient()); } catch { return log_and_204; }
```

Cleanup code follows the same rule: do not call an unguarded cleanup step in front of a `try/catch`'d one
(for example `detachCulling()` before a guarded series removal).

<a id="SA-4"></a>

#### SA-4 — Log before degrading

An unexpected error that is turned into an error result, an empty value or a fallback must be logged first
(`console.error('[moduleName] operation failed:', err)`), otherwise the root cause is invisible. The same applies
when an optional cost-saving store (DB-backed cache, memo layer) is unavailable: log once per process, so a
misconfiguration that makes every request pay the full provider cost shows up in the logs. Do not leave debug
`console.log` calls in actions, API modules or adapters; logging belongs at the boundary that handles the failure.

```typescript
// ❌ no trace of the cause
catch (err) { return { error: 'service_unavailable' }; }

// ✅
catch (err) {
    console.error('[quoteAction] fetch failed:', err);
    return { error: 'service_unavailable' };
}
```

<a id="SA-5"></a>

#### SA-5 — One status per outcome

A status that means "nothing to do" (`alreadyFresh`) must not also absorb failures, skip reasons or cooldowns when
the caller reacts to the status (revalidation, re-fetch, logging). Give every distinct outcome its own value
(`alreadyFresh`, `cooldown`, `failed`); otherwise outages look like normal success and callers invalidate caches
for values that were never confirmed.

<a id="SA-6"></a>

#### SA-6 — Fire-and-forget work has a timeout and swallows errors

Fire-and-forget `fetch()` calls carry a timeout (`signal: AbortSignal.timeout(5000)`), and fire-and-forget Server
Actions catch, `console.warn` and return normally; an error that propagates from background work blocks or breaks
the caller. When code reads back something written by an un-awaitable fire-and-forget write (for example a cache
`SET` the library does not await), a single immediate read can race the write and report a false mismatch: retry
the read a bounded number of times before concluding.

```typescript
// ❌ throws into the caller, can hang forever
async function cancelAction() { await fetch('/cancel', { method: 'POST' }); }

// ✅
async function cancelAction() {
    try {
        await fetch('/cancel', { method: 'POST', signal: AbortSignal.timeout(5000) });
    } catch (e) {
        console.warn('Background action failed', e);
    }
}
```

### Input validation

<a id="SA-7"></a>

#### SA-7 — Validate in order: type, size, then parse

Check `typeof`/`instanceof` first, then length or byte size, and only then run a regex, `String()` conversion or
parse. A size cap placed after the regex still lets an oversized input trigger quadratic backtracking; stringifying
an untrusted object before the size check runs its arbitrary `toString()`. Validate size before mutating state too
(do not decrement a budget and then reject the oversized write).

<a id="SA-8"></a>

#### SA-8 — Match fixed codes as whole tokens

Do not detect fixed codes (SQLSTATE, error ids, constants) with `includes()` or an unanchored regex; user data such
as `pk_constraint_53300_check` produces false positives. Use `\b(code1|code2)\b`, or extract the code and test
`Set#has`.

<a id="SA-9"></a>

#### SA-9 — Enforce the real constraint at the server trust boundary

Never rely on client-side normalization (`trim()`, length limits) for a rule the server depends on. Whitespace-only
input that the client would have rejected must also be rejected by the server-side validator. Route handlers
reject invalid types and formats with `400` (not `204` or silence), and validate against an explicit allowlist
(`Set`), not a truthiness check.

<a id="SA-10"></a>

#### SA-10 — A "never throws" contract holds for every valid input form

A helper documented as never throwing (IP canonicalization, parsers) must be tested against every legal input shape,
not just the common one: IPv6 with a zone id (`fe80::1%eth0`), IPv4-mapped IPv6 (`::ffff:192.0.2.1`), empty and
oversized values. Either handle the shape or narrow the documented contract.

<a id="SA-11"></a>

#### SA-11 — Sanitize logged user input

Truncate or escape user-controlled payloads before logging (`JSON.stringify(body).slice(0, 500)`). A raw newline
turns one log record into two and can trigger log-based metric filters or poison parsers.

### External API contracts

<a id="SA-12"></a>

#### SA-12 — Verify field semantics against known reference events

Do not infer a provider field's meaning (timezone, unit, adjusted vs raw) from field names or from how earlier code
treated it. Check it against an event whose real value is known (a central-bank decision, an exchange close) and
record the result next to the parsing code. A field assumed to be local wall-clock time that is actually UTC shifts
every consumer by hours without any error.

<a id="SA-13"></a>

#### SA-13 — Pass range parameters and validate freshness

Endpoints that default to "latest available" may silently return old rows when a bound parameter (`to`, `limit`) is
omitted. Pass explicit range parameters, then validate that the result is fresh and complete enough for the caller
instead of trusting a 200.

### Timeouts

<a id="SA-14"></a>

#### SA-14 — Remote reads on a deadline-bound path carry their own timeout

Any new network read on a request path that has a time budget must be inside that budget with its own timeout, not
rely on the client library's default (some HTTP-based DB drivers have none). A hung read then degrades to the
fallback instead of consuming the whole deadline. For loops under a deadline, see CC-5.

### Request trust & abuse

<a id="SA-15"></a>

#### SA-15 — Trust decisions use only non-spoofable inputs

Exemptions, quota bonuses and rate-limit classes must be keyed on values the client cannot forge: the client IP set
by the edge, a verified reverse-DNS result. Never key them on `X-Forwarded-For` fallbacks, `User-Agent` or custom
headers; a generic script client can claim to be a crawler. Public routes that call a paid upstream get a per-IP
rate limit through one shared helper, not a copy per route.

<a id="SA-16"></a>

#### SA-16 — Security allowlists name exact patterns

An allowlist for verified hosts (reverse-DNS suffixes and the like) lists exact domain or subdomain patterns. A bare
suffix match admits unrelated hosts under the same parent (mail servers, dev instances). Pin the accepted pattern
with a test that includes a near-miss that must be rejected.

<a id="SA-17"></a>

#### SA-17 — Cap in-flight work per untrusted input

Work triggered per client-supplied value (DNS lookups, Redis calls) needs a per-value in-flight cap and a
memory-only rejection path once the cap is hit; otherwise one spoofed value can hold every slot and starve the
rest. Test the capacity bound, negative lookups (NODATA/NXDOMAIN) and mapped address forms, not only the happy path.

---

## Concurrency, Batching & Background Work

<a id="CC-1"></a>

#### CC-1 — Bound provider fan-out

Never fan out an unbounded `Promise.all`/`Promise.allSettled` over provider calls. Name the limit per call site
(`QUOTE_CONCURRENCY`, `SYMBOL_CONCURRENCY`, ...), process items in chunks of that size and await each chunk. Provider
limits differ (FMP depends on the plan, `yahoo-finance2` is unofficial, LLM providers depend on the API tier), and
two chunked pipelines started together double the effective concurrency. Use `Promise.allSettled` inside a chunk
when one failure must not discard its siblings.

```typescript
// ❌ every symbol at once
await Promise.allSettled(SECTOR_STOCKS.map(fetchQuote));

// ✅ bounded chunks
for (const chunk of chunked(SECTOR_STOCKS, QUOTE_CONCURRENCY)) {
    await Promise.allSettled(chunk.map(fetchQuote));
}
```

<a id="CC-2"></a>

#### CC-2 — A gate protects only the work that depends on it

An early return or guard (`if (changed === 0) return`) must not skip downstream work whose input is not derived from
the gated value. It is safe when everything after it is derived from the gated input (an empty `fresh` list makes
`fresh.filter(...)` empty too); it is unsafe when a later step re-queries the DB or another source for state that is
independent of the gated input. Gate the specific side effect (a cache invalidation) and let the rest fall through.

<a id="CC-3"></a>

#### CC-3 — Capped loops report processed vs total

A scan with a per-run cap (`LIMIT = 20`) must report how many rows it processed and whether the limit was hit, so
"finished" and "stopped at the cap" are distinguishable in logs and return values.

<a id="CC-4"></a>

#### CC-4 — Reset counters per pass

Counters in multi-pass jobs (`failed`, `processed`) are reset at the start of each pass or count distinct rows. A
counter that accumulates across passes counts attempts, can exceed the table size and misleads the closing summary.

<a id="CC-5"></a>

#### CC-5 — Hold a lock only as long as the per-item timeout allows

When a loop holds a lock or TTL-bound slot, give every iteration its own timeout; a deadline checked only between
targets lets one hung target keep the lock past its TTL.

<a id="CC-6"></a>

#### CC-6 — A long gate must not engage while capped work remains

A per-run cap combined with a long re-run gate (hours) drains a backlog extremely slowly. Set the long gate only
when the backlog is empty (return `pending` from the capped step), so the backlog drains over consecutive short runs,
or document the drain time next to the cap.

<a id="CC-7"></a>

#### CC-7 — Time budget is the sum of worst cases

For a unit chaining several capped steps (ingest + analysis + sequential translations), the documented time budget
is the sum of each step's worst case, written next to the caps. A budget claimed from the typical case silently
exceeds the platform timeout.

<a id="CC-8"></a>

#### CC-8 — Bound a drain loop with a sufficiency condition

"Drain until empty" never terminates for sources that produce faster than the job consumes. Stop on a sufficiency
condition (enough processed this run, backlog below a threshold) and make sure the downstream gate can still engage.

<a id="CC-9"></a>

#### CC-9 — Retry and fallback decisions are sticky across steps

When retry or fallback logic repeats a function, state that was reduced or decided earlier (a consumed budget, "this
provider is stalling, use the fallback") is passed through explicitly, for example one ref created above the retry
loop. Re-initializing it per call or per step resets the reduction (a multi-step turn pays a stall timeout on every
step) and loses what earlier attempts learned.

<a id="CC-10"></a>

#### CC-10 — State concurrency bounds per path, and make limit checks atomic

- A concurrency comment names the bound per code path. Two chunked calls inside one `Promise.all`, or another fetch
  running alongside, add their in-flight counts, so "batch-wide limit N" is false unless one shared limiter enforces it.
- A count-then-insert limit check (per-user cap) races across tabs and requests. Run it in a transaction holding a row
  lock on the owner, and let an item that already exists bypass the cap instead of failing the re-add.

---

## Server Data Cache Rules (`unstable_cache` / `fetch`)

In production the Next data cache (every `unstable_cache` entry and every cached `fetch()`)
lives in S3 under a prefix that is **shared across deploys**:
`siglens-isr/data-v<DATA_CACHE_VERSION>-next<next version>/fetch/`
(`cache-handler/config.mjs`). Page/HTML entries stay build-scoped. A deploy therefore does
**not** clear cached data, and during a rolling deploy old and new builds read each other's
entries. If you change what a cached function returns without changing its key, the new code
reads values in the old shape (and the old code reads the new shape).

When you change the **shape or meaning** of a cached value, change its key in the same PR:

| Change | Do this |
|---|---|
| One cache entry's return shape (fields added/removed/renamed, units, enum values) | Bump that call site's versioned keyPart: `['bars-static-v2', …]` → `'bars-static-v3'`. If the key has no version yet, add `-v1` now. |
| A helper shared by many cached call sites changes shape, or the entry wrapper/serialization changes (`cache-handler/serialize.mjs`, `index.mjs` entry) | Bump `DATA_CACHE_VERSION` in `cache-handler/config.mjs` (the whole data cache restarts cold once). |
| The data must be re-read on every deploy (e.g. legal terms published "effective on deploy") | Put the release id (`process.env.GIT_SHA`) in the keyParts — see `TERMS_RELEASE_ID` in `entities/terms/api.ts`. Use sparingly: that entry goes cold every deploy. |
| A Next.js upgrade | Nothing — the Next version is part of the prefix. |
| Only the request changes (`fetch()` URL, headers, body) or the TTL/tags | Nothing — the key or the read-time check already changes. |

```typescript
// ✅ shape changed (added `vwap`) → key version bumped in the same PR
unstable_cache(load, ['bars-static-v3', ticker, timeframe], { revalidate, tags });

// ❌ shape changed but key kept → old/new builds share incompatible entries
unstable_cache(load, ['bars-static-v2', ticker, timeframe], { revalidate, tags });
```

**`staticSymbolCache` / `cacheNonEmpty*` keys** are keyParts only: the wrapper passes a fixed
callback and prepends `STATIC_SYMBOL_CACHE_VERSION` (`'ssc-v1'`), so two call sites with the same
keyParts read **the same entry**. That makes key stability the call site's job:

- Build keyParts only from inputs that decide the result, so every build produces the same strings.
- When a fetcher's return shape or meaning changes, add or bump a `-vN` keyPart for that call site in the
  same PR (`'fundamental:profile'` → `'fundamental:profile-v2'`).
- Never let two call sites share keyParts unless they return the same data. Check with
  `rg "staticSymbolCache|cacheNonEmpty"` before adding a key.
- Bump `STATIC_SYMBOL_CACHE_VERSION` only when the wrapper itself changes meaning; that retires every
  entry it owns at once.

The old prefix/keys are not deleted by hand; the bucket's 7-day lifecycle removes them.

### Cache Correctness Rules

<a id="DC-1"></a>

#### DC-1 — Cache keys include every result-affecting input

Every parameter that can change the output is in the key, and when a function gains a parameter (a `limit`, a new
option) every key construction site is audited. A closure-captured value that is not in the key makes different
requests share one entry. This includes dedup hashes: a snapshot's `content_hash` must cover every field that can
differ between users (chart data, locale, plain-language prose); a field missing from the hash means a second user
silently inherits the first user's row. Canonical detail lives in the JSDoc of
`entities/shared-analysis/lib/contentHash.ts`.

```typescript
// ❌ limit added later, key unchanged
buildBarsRawKey(symbol, timeframe) { return `bars:${symbol}:${timeframe}`; }

// ✅
buildBarsRawKey(symbol, timeframe, limit) { return `bars:${symbol}:${timeframe}:${limit}`; }
```

<a id="DC-2"></a>

#### DC-2 — Key formation is identical for every caller class

Optional key fields are included or excluded the same way for every caller class (bot, user, prewarm, server). A
request path that skips a key input creates its own namespace, so prewarmed entries never hit for that class.
When a dependency adds an optional field to its key builder, grep every call site and update them together; types
and unit tests will not catch it, so add a test that the classes hit the same key.

<a id="DC-3"></a>

#### DC-3 — Every branch stores the same cached shape

Background jobs, retry paths and fallbacks write the same fields as the main path (`fmpSymbol` present on both).
A narrower shape from one path is read later by code that assumes the full shape.

<a id="DC-4"></a>

#### DC-4 — Wrap multi-use RSC loaders in React `cache()`

A loader called several times per request (for example one provider constructed three times in one page) is wrapped
in React `cache()` and called through the same helper with the same arguments; `cache()` dedupes by reference
identity, so a different wrapper or equal-but-distinct argument objects miss. Document any discard cost when work is
started early (`cache()` also replays rejections).

<a id="DC-5"></a>

#### DC-5 — Rehydrate every `Date` field after the JSON round trip

`unstable_cache` serializes to JSON, so a cache hit returns `Date` columns as strings while the type says `Date`.
Rehydrate each Date field next to its siblings in the read path, and extend that code whenever a new Date column is
added.

<a id="DC-6"></a>

#### DC-6 — Count remote round-trips and bytes before claiming savings

Reordering lookups can put a large shared-cache read in front of every request: the command count stays the same
and the bytes multiply. Count round-trips and payload size per path, and remember that helper mocks hide both. New
short-lived entries never reuse a key that still holds legacy values in a different shape or TTL (see the key
versioning table above).

<a id="DC-7"></a>

#### DC-7 — On refresh failure serve the last good value

A memo or cache that refreshes periodically returns the previous (even expired) value when the refresh fails, and
keeps its expiry so the next call retries. Returning an empty value turns a transient failure into wrong answers
(entries briefly classified as unknown).

<a id="DC-8"></a>

#### DC-8 — Keep a short-lived fallback write when removing a cache layer

A cache layer often also absorbs failures of the layer behind it (DB unavailable). Before removing one, write down
what it absorbed and keep a short-TTL fallback write for the DB-unavailable path, otherwise an outage becomes
repeated provider calls. Back the fallback with a test that fails when the write is removed (see TESTING.md#TE-13).

---

## Database & Migrations

<a id="DB-1"></a>

#### DB-1 — Migration journal entries are in chronological order

`drizzle/meta/_journal.json` lists migrations earliest first; out-of-order entries break drizzle-kit's assumptions.
If an applied migration turns out to be wrong, do not edit it retroactively; add a new forward migration.

<a id="DB-2"></a>

#### DB-2 — Every migration file is registered in the journal

An `.sql` file in `drizzle/` that is not in `_journal.json` is ignored by `drizzle-kit migrate` and becomes dead code
with duplicate-schema risk. Each SQL file has a journal entry.

<a id="DB-3"></a>

#### DB-3 — Published seeds are immutable; publish a new version

Seed rows written with `onConflictDoNothing` (terms, privacy text) cannot be changed by editing the source file once
the row exists. Publish a new version (new id, effective date) instead of editing the committed one. Generated
manifests follow the same logic: after editing sources run the generator (see I18-1) so downstream output is not stale.

<a id="DB-4"></a>

#### DB-4 — Scripts that write to an env-resolved DB call the remote-write guard first

A script writing to a database resolved from the environment calls `guardRemoteWrite(databaseUrl, '<name>')`
(`db/scripts/lib/dbTarget.ts`) before connecting. Docs must not claim broader coverage than the code provides
(for example "covers every `yarn db:*` script") unless every such script calls it.
