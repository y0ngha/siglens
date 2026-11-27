#!/usr/bin/env node
// SiglensAI 에이전트 회귀 평가 실행기 (로컬 전용, 실제 provider — CI에서 돌지 않는다).
//
// 실제 스택을 HTTP로 통째로 몬다: 프롬프트·도구 명세·실행기·저장·어댑터가 한 번에 검증된다.
// 먼저 `scripts/agent-eval/dev-server.sh`로 로컬 dev 서버(4200)를 띄워 둔다.
//
//   node scripts/agent-eval/run.mjs --label new --cache --out /path/new.json
//   node scripts/agent-eval/run.mjs --only osc-1,div-2 --out /path/part.json
//   node scripts/agent-eval/run.mjs --compare /path/old.json /path/new.json
//
// 플래그
//   --label <name>      결과 JSON에 적는 이름(old/new 등).
//   --only a,b          케이스 id만 돌린다(conv의 턴은 conv 하나로 센다). 모르는 id는 시작 전에 거절한다(종료 코드 2).
//   --cache             conv(4턴) 케이스까지 돌려 접두사 캐시 검사를 켠다. 없으면 conv는 건너뛴다.
//   --out <file>        transcript JSON 저장 경로(필수 — 레포 밖 스크래치 경로를 쓴다).
//   --compare a b       두 결과 JSON을 견줘 표로 출력한다(서버·DB 불필요).
//   --reference <file>  같은 케이스·턴의 다른 실행 결과 JSON. 도구를 안 불러 저장 결과가 없는 OLD 답변을 NEW의 저장된
//                       `get_price_stats` 결과로 판정한다(둘 다 같은 날 실행, 종가가 그대로여야 한다).
//   --no-web-search     web_search가 없는 서버라고 강제로 알린다. 주지 않으면 dev-server.sh가 쓴 상태 파일(AGENT_EVAL_STATE_FILE,
//                       기본 scripts/agent-eval/.server-state.json)에서 읽고, 그것도 없으면 턴 결과로 추정한다.
//                       web_search를 내놓지 않은 서버에서 holder 케이스는 실패가 아니라 "평가 불가"로 보고된다.
//   --site <url>        기본 http://localhost:4200
//   --ai <url>          기본 http://ai.localhost:4200
//   --turn-at-fallback  user 행에 turn_at이 없으면(시각을 저장하지 않는 옛 앱) created_at으로 메모를 다시 만든다.
//
// 환경변수: DATABASE_URL(없으면 .env.e2e의 DATABASE_URL 한 줄만 읽는다. 값은 출력하지 않는다).
// AGENT_EVAL_NOTE_CORE: 기준 메모를 만들 core 패키지 디렉터리(없으면 설치된 core). 옛 앱(OLD)을 잴 때 새 core를
// 가리키면 검사가 같은 형식의 "정답" 메모로 판정한다 — 이때 메모는 모델이 본 문구가 아니라 그 시각의 기준값이다.
// 시작 때 사이트 두 주소와 DB 주소가 모두 localhost/127.0.0.1(또는 *.localhost)이 아니면 종료 코드 2로 멈춘다.
//
// 로그인은 사이트 호스트의 /login 폼으로 시드된 e2e 회원(e2e/support/authUser.ts)을 쓴다. 세션 쿠키는
// 호스트 한정이라 ai 호스트로 복사해 넣는다. 요청은 ai 호스트 페이지 안에서 fetch로 보낸다 —
// 브라우저가 Origin을 알아서 붙이고 *.localhost를 해석한다. 헤드리스 UA는 봇으로 403이라 데스크톱 UA를 쓴다.
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { chromium } from '@playwright/test';
import * as installedCore from '@y0ngha/siglens-core';
import { tsImport } from 'tsx/esm/api';
import postgres from 'postgres';
import { CASES } from './cases.mjs';
import {
    EVAL_TIME_ZONE,
    buildTranscript,
    compareRuns,
    isLocalUrl,
    parseSseFrames,
    runChecks,
    selectCases,
    sideEffects,
} from './checks.mjs';
import { isStrictLocalAddress } from './localGuard.mjs';

const E2E_EMAIL = 'e2e-auth-user@test.com';
const E2E_PASSWORD = 'E2eAuthUser1!';
// 모델이 본 메모는 DB에 없다(저장하는 것은 `turn_at` 시각뿐). 같은 시각·로케일·시간대·KRX 스펙으로 core가 다시 만든다.
// 요청마다 이 시간대 헤더를 보내므로 서버가 쓴 값과 같다(로케일은 한국어 로그인 화면이라 ko).
const EVAL_LOCALE = 'ko';
const TIME_ZONE_HEADER = 'x-siglens-timezone';
const DESKTOP_UA =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const TURN_TIMEOUT_MS = 180_000;

const argv = process.argv.slice(2);
const flag = name => argv.includes(`--${name}`);
const option = name => {
    const index = argv.indexOf(`--${name}`);
    return index >= 0 ? argv[index + 1] : undefined;
};

function fail(message, code = 1) {
    process.stderr.write(`${message}\n`);
    process.exit(code);
}

/** .env.e2e에서 DATABASE_URL 한 줄만 읽는다(다른 값은 읽지도 출력하지도 않는다). */
function databaseUrlFromE2eEnv() {
    try {
        const line = readFileSync('.env.e2e', 'utf8')
            .split('\n')
            .find(l => l.startsWith('DATABASE_URL='));
        return line
            ?.slice('DATABASE_URL='.length)
            .trim()
            .replace(/^["']|["']$/g, '');
    } catch {
        return undefined;
    }
}

function printComparison(oldPath, newPath) {
    const rows = compareRuns(
        JSON.parse(readFileSync(oldPath, 'utf8')),
        JSON.parse(readFileSync(newPath, 'utf8'))
    );
    process.stdout.write(
        'id\told fails\tnew fails\told n/e\tnew n/e\tdropped tools\tadded tools\n'
    );
    const side = e =>
        e === null
            ? '-'
            : `chars ${e.answerChars}, figures ${e.figureSentences}, steps ${e.steps}, tools ${e.toolCalls}, search ${e.webSearches}, ungrounded ${e.ungroundedNumbers ?? '?'}`;
    rows.forEach(row =>
        process.stdout.write(
            `${row.id}\t${row.oldFails ?? '-'}\t${row.newFails}\t${row.oldNotEvaluable ?? '-'}\t${row.newNotEvaluable}\t${row.droppedTools.join(',') || '-'}\t${row.addedTools.join(',') || '-'}${row.droppedTools.length > 0 ? '\t<-- REGRESSION' : ''}\n    old: ${side(row.oldSideEffects)}\n    new: ${side(row.newSideEffects)}\n`
        )
    );
}

if (flag('compare')) {
    const [a, b] = [option('compare'), argv[argv.indexOf('--compare') + 2]];
    if (!a || !b) fail('usage: --compare <old.json> <new.json>');
    printComparison(a, b);
    process.exit(0);
}

const siteUrl = option('site') ?? 'http://localhost:4200';
const aiUrl = option('ai') ?? 'http://ai.localhost:4200';
const databaseUrl = process.env.DATABASE_URL ?? databaseUrlFromE2eEnv();
const outPath = option('out');
const label = option('label') ?? 'run';
const only = option('only')?.split(',');
const referencePath = option('reference');
const referenceRun = referencePath
    ? JSON.parse(readFileSync(referencePath, 'utf8'))
    : null;
const { selected, errors: selectionErrors } = selectCases(
    CASES,
    only,
    flag('cache')
);
if (selectionErrors.length > 0) fail(selectionErrors.join('\n'), 2);

if (
    !isLocalUrl(siteUrl) ||
    !isLocalUrl(aiUrl) ||
    !databaseUrl ||
    // DB는 `*.localhost`도 받지 않는 엄격한 판정을 쓴다(사이트 주소는 `ai.localhost`가 필요해 isLocalUrl).
    !isStrictLocalAddress(databaseUrl)
)
    fail(
        'refusing to run: the site URL, the AI URL and DATABASE_URL must all point at localhost / 127.0.0.1 (this script spends real provider tokens and reads chat rows).',
        2
    );
if (!outPath) fail('--out <file> is required');

const sql = postgres(databaseUrl, { max: 1 });
const { buildAgentTurnContext } = process.env.AGENT_EVAL_NOTE_CORE
    ? createRequire(import.meta.url)(process.env.AGENT_EVAL_NOTE_CORE)
    : installedCore;

/** 대화의 행을 읽는다. 컬럼명은 transcript가 쓰는 camelCase로 별칭을 단다. */
const readRows = conversationId =>
    sql`select id, seq, role, content, tool_name as "toolName", tool_calls as "toolCalls", turn_at as "turnAt",
        created_at as "createdAt"
        from chat_messages where conversation_id = ${conversationId} order by seq`;

/**
 * 이 스크립트가 말하는 dev 서버가 로컬 e2e DB를 쓰는지 확인한다(운영 DB에 대화·행을 만들지 않으려는 안전장치).
 * - 시작 전: 로컬 DB에 시드된 e2e 회원이 있고 `turn_at` 컬럼(새 마이그레이션)이 있어야 한다.
 * - 워밍 턴 뒤: 서버가 만든 대화가 이 DB에서 읽혀야 한다. 다른 DB를 쓰는 서버면 대화가 여기 없다.
 * 로그인은 서버가 e2e 회원을 알아야만 되므로 운영 서버에는 애초에 붙지 못한다.
 */
async function assertLocalSeed() {
    const [user] =
        await sql`select 1 as ok from users where email = ${E2E_EMAIL}`;
    if (user === undefined)
        fail(
            'refusing to run: the local database has no seeded e2e user. Run `yarn e2e:up && yarn e2e:db` first.',
            2
        );
    const [column] = await sql`select 1 as ok from information_schema.columns
        where table_name = 'chat_messages' and column_name = 'turn_at'`;
    if (column === undefined)
        fail(
            'refusing to run: chat_messages.turn_at is missing in the local database. Re-run `yarn e2e:db` (it applies the migrations).',
            2
        );
}

async function assertServerUsesLocalDb(conversationId) {
    const rows = conversationId ? await readRows(conversationId) : [];
    if (rows.length === 0)
        fail(
            "refusing to continue: the conversation the dev server just created is not in DATABASE_URL's database, so the server is not using the local e2e database. Start it with scripts/agent-eval/dev-server.sh.",
            2
        );
}

async function login(context) {
    const page = await context.newPage();
    await page.goto(`${siteUrl}/login`);
    await page.getByLabel('이메일').fill(E2E_EMAIL);
    await page.getByLabel('비밀번호', { exact: true }).fill(E2E_PASSWORD);
    await page.getByRole('button', { name: '로그인' }).click();
    await page.waitForURL(url => !url.pathname.startsWith('/login'));
    // 세션 쿠키는 사이트 호스트 한정이라 ai 호스트에도 같은 값으로 복사한다.
    const cookies = await context.cookies(siteUrl);
    await context.addCookies(
        cookies.map(({ name, value, httpOnly, sameSite }) => ({
            name,
            value,
            httpOnly,
            sameSite,
            domain: new URL(aiUrl).hostname,
            path: '/',
            secure: false,
        }))
    );
    await page.goto(aiUrl);
    return page;
}

/** ai 호스트 페이지 안에서 한 턴을 보내고 SSE 본문 전체를 받는다. */
const sendTurn = (page, body) =>
    page.evaluate(
        async ({ url, payload, headerName, timeZone }) => {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    [headerName]: timeZone,
                },
                body: JSON.stringify(payload),
            });
            return response.text();
        },
        {
            url: `${aiUrl}/api/ai/chat/stream`,
            payload: body,
            headerName: TIME_ZONE_HEADER,
            timeZone: EVAL_TIME_ZONE,
        }
    );

/** 한 케이스(또는 conv의 턴 목록)를 돌려 transcript와 판정을 모은다. */
async function runCase(page, testCase) {
    const turns = testCase.turns ?? [{ ...testCase, id: testCase.id }];
    const done = await turns.reduce(
        async (previousRun, turn, index) => {
            const acc = await previousRun;
            process.stdout.write(
                `  ${testCase.id}${testCase.turns ? `-t${index + 1}` : ''}: ${turn.question}\n`
            );
            const text = await sendTurn(page, {
                conversationId: acc.conversationId,
                message: turn.question,
                action: 'send',
            });
            const frames = parseSseFrames(text);
            const meta = frames.find(f => f.event === 'meta')?.data;
            const conversationId = meta?.conversationId ?? acc.conversationId;
            const rows = (
                conversationId ? await readRows(conversationId) : []
            ).map(row =>
                flag('turn-at-fallback') &&
                row.role === 'user' &&
                (row.turnAt === null || row.turnAt === undefined)
                    ? { ...row, turnAt: row.createdAt }
                    : row
            );
            const transcript = buildTranscript({
                question: turn.question,
                frames,
                rows,
                noteFor: turnAt =>
                    buildAgentTurnContext({
                        locale: EVAL_LOCALE,
                        now: new Date(turnAt),
                        timeZone: EVAL_TIME_ZONE,
                        krSession: krEquitySession,
                    }),
                webSearchAvailable: serverWebSearch,
            });
            const checked = runChecks(
                { ...turn, id: `${testCase.id}-t${index + 1}` },
                transcript,
                acc.transcripts.at(-1) ?? null,
                // conv는 턴 번호로, 단일 턴 케이스는 첫 턴으로 같은 케이스의 기준 실행 transcript를 찾는다.
                referenceRun?.results?.find(r => r.id === testCase.id)?.turns?.[
                    index
                ] ?? null
            );
            return {
                conversationId,
                transcripts: [...acc.transcripts, transcript],
                fails: [...acc.fails, ...checked.fails],
                reviews: [...acc.reviews, ...checked.reviews],
                notEvaluable: [...acc.notEvaluable, ...checked.notEvaluable],
            };
        },
        Promise.resolve({
            conversationId: null,
            transcripts: [],
            fails: [],
            reviews: [],
            notEvaluable: [],
        })
    );
    return {
        id: testCase.id,
        turns: done.transcripts,
        // 판정이 아닌 부작용 수치(답변 길이, 수치 문장, 단계·도구·검색 수, 근거 없는 숫자): `--compare`가 견준다.
        sideEffects: done.transcripts.map(t =>
            sideEffects(t, installedCore.findUngroundedNumbers)
        ),
        fails: done.fails,
        reviews: done.reviews,
        notEvaluable: done.notEvaluable,
        // 이 케이스의 마지막 턴에서 본 web_search 가용 여부(true/false/null=알 수 없음).
        webSearchAvailable: done.transcripts.at(-1)?.webSearchAvailable ?? null,
    };
}

/**
 * 이 서버가 web_search를 내놓는지. dev-server.sh가 키 유무(값 아님)로 쓴 상태 파일을 읽는다 — 서버가 내놓는 도구
 * 목록은 HTTP로 보이지 않는다. `--no-web-search`는 강제로 끈다. 파일이 없거나 읽을 수 없으면 null(알 수 없음):
 * 그때는 각 턴에서 web_search 호출·`unavailable` 결과로 추정한다(`inferWebSearchAvailable`).
 */
function readServerWebSearch() {
    if (flag('no-web-search')) return false;
    try {
        const state = JSON.parse(
            readFileSync(
                process.env.AGENT_EVAL_STATE_FILE ??
                    new URL('.server-state.json', import.meta.url),
                'utf8'
            )
        );
        return typeof state.webSearch === 'boolean' ? state.webSearch : null;
    } catch {
        return null;
    }
}
const serverWebSearch = readServerWebSearch();

// KRX 휴장일 목록은 앱이 쥐고 있다(core에는 없다). 서버와 같은 스펙을 앱 소스에서 그대로 읽는다.
const { KR_EQUITY_SESSION: krEquitySession } = await tsImport(
    '../../src/shared/api/market/sessionSpecFor.ts',
    import.meta.url
);

await assertLocalSeed();
const browser = await chromium.launch();
try {
    const context = await browser.newContext({ userAgent: DESKTOP_UA });
    const page = await login(context);
    page.setDefaultTimeout(TURN_TIMEOUT_MS);
    // 첫 질문은 캐시 워밍(공급자 접두사 캐시는 키 단위)이라 결과에 넣지 않는다.
    const warmUp = await sendTurn(page, {
        conversationId: null,
        message: '안녕',
        action: 'send',
    });
    await assertServerUsesLocalDb(
        parseSseFrames(warmUp).find(f => f.event === 'meta')?.data
            ?.conversationId ?? null
    );
    const results = await selected.reduce(async (previous, testCase) => {
        const acc = await previous;
        const result = await runCase(page, testCase);
        result.fails.forEach(line =>
            process.stdout.write(`    FAIL ${line}\n`)
        );
        result.reviews.forEach(line =>
            process.stdout.write(`    review ${line}\n`)
        );
        result.notEvaluable.forEach(line =>
            process.stdout.write(`    NOT EVALUABLE ${line}\n`)
        );
        return [...acc, result];
    }, Promise.resolve([]));
    writeFileSync(
        outPath,
        JSON.stringify(
            {
                label,
                startedAt: new Date().toISOString(),
                // 이 실행이 확인한 서버 사실. webSearch가 false면 holder 케이스는 평가 불가로 나온다.
                server: { webSearch: serverWebSearch },
                results,
            },
            null,
            2
        )
    );
    const failed = results.filter(r => r.fails.length > 0).length;
    // A not-evaluable line is never a pass: count them beside the failures so a quiet run is not read as a clean one.
    const notEvaluable = results.reduce((n, r) => n + r.notEvaluable.length, 0);
    const notEvaluableCases = results.filter(
        r => r.notEvaluable.length > 0
    ).length;
    process.stdout.write(
        `${results.length} cases, ${failed} with failures, ${notEvaluable} not evaluable lines in ${notEvaluableCases} cases -> ${outPath}\n`
    );
} finally {
    await browser.close();
    await sql.end();
}
