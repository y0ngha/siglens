# Agent regression eval (local only)

Drives the real SiglensAI stack over HTTP with a real LLM provider and judges the stored answers and tool rows.
It spends provider tokens and web-search quota, so it **never runs in CI** and is not part of `yarn test`.
The judging functions are pure and unit-tested in `scripts/__tests__/agent-eval-checks.test.ts` (those do run in CI).

## Bring up the local stack

```bash
yarn e2e:up && yarn e2e:db        # local Postgres + Redis, seeded e2e user, all migrations applied
scripts/agent-eval/dev-server.sh  # dev server on :4200 against that stack; leave it running
```

`dev-server.sh`:

- Takes the database and Redis from `.env.e2e`. A `DATABASE_URL` or `UPSTASH_REDIS_REST_URL` set in the calling shell wins
  over `.env.e2e` (a stack on other ports). Before starting, `localGuard.mjs` checks the value the server will actually use
  for each of those two (the shell value if set, else the `.env.e2e` one) and exits 2 unless its host is `localhost`,
  `127.0.0.1` or `::1`. Those are the only database and Redis address variables the app reads. It prints `name -> host:port`
  only, never credentials or tokens. `run.mjs` does not talk to Redis; it applies the same local-host rule to
  `DATABASE_URL`, `--site` and `--ai`.
- Masks every key that exists only in `.env.local`, then re-reads a small allowlist of provider keys without echoing them.
- Turns **fixtures off** (`E2E_TEST` is forced empty, `AGENT_REAL_PROVIDER=1`). With fixtures on, every symbol returns the
  same bars and the results mean nothing.
- Records whether `web_search` is offered (key presence only, never a value) in `scripts/agent-eval/.server-state.json`
  (`AGENT_EVAL_STATE_FILE` overrides the path). `run.mjs` reads it.

## Run

```bash
node scripts/agent-eval/run.mjs --label new --cache --out <scratch>/new.json
node scripts/agent-eval/run.mjs --only osc-1,div-2 --out <scratch>/part.json   # targeted re-check
node scripts/agent-eval/run.mjs --compare <scratch>/old.json <scratch>/new.json
```

Flags: `--label`, `--only a,b` (unknown ids are refused before anything runs; `conv` needs `--cache`), `--cache`
(adds the 4-turn `conv` case and its cached-prefix check), `--out <file>` (required, keep it outside the repo),
`--compare a b`, `--site <url>` (default `http://localhost:4200`), `--ai <url>` (default `http://ai.localhost:4200`),
`--no-web-search` (force "web_search not offered"), `--turn-at-fallback` (when measuring an older app that stores no
`turn_at`, rebuild the clock note from `created_at`).

Environment: `DATABASE_URL` (otherwise the one line is read from `.env.e2e`), `AGENT_EVAL_STATE_FILE`,
`AGENT_EVAL_NOTE_CORE` (path of the core build used to rebuild the reference clock note, for an older app).
`run.mjs` exits 2 unless the site URLs and the database are local, the seeded e2e user and the `turn_at` column exist,
and the dev server's conversation shows up in that database.

## Output

Per case: `fails` (hard), `reviews` (for a human or judge), and `notEvaluable` (a check that could not be decided, such as
the `holder` case when `web_search` is not offered, or earnings day counts when the tool result lacks the field). A
`notEvaluable` line is never a pass. The JSON records `server.webSearch` (`true`, `false`, or `null` when unknown).

## Budget

About 45 provider calls per variant (14 single-turn cases plus the 4-turn `conv`), roughly twice that for an old/new
comparison, plus up to two web searches per variant from the shared daily search budget. Send nothing else through the
same key while measuring cache behaviour, and compare cached tokens from turn 2 on only. Use `--only` to re-check one
case instead of the whole set.
