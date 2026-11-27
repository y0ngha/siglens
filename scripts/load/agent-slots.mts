/**
 * 에이전트 턴 슬롯 부하 시험 (개발 도구, CI에서 돌리지 않는다).
 *
 * 로컬 E2E 스택(`E2E_TEST=1`, fake provider)에 게스트 쿠키 N개로 `POST /api/ai/chat/stream`을 쏘아
 * 슬롯 주차와 대기열(`stream/_lib/turnSlots.ts`)이 용량 거절(503)을 얼마나 줄이는지 잰다. LLM·운영
 * 시스템은 부르지 않는다 — 턴은 fake provider의 시험 이음매로만 길어진다.
 *
 *   `[e2e-fresh]`        첫 단계에서 run_fresh_analysis를 부른다. 서버를 `E2E_FAKE_FRESH_ANALYSIS_MS=90000`
 *                        으로 띄우면 그 분석이 90초 걸린 것처럼 슬롯을 쥔다.
 *   `[e2e-hold:<ms>]`    최종 답을 <ms>만큼 미룬다(모델·도구 시간 흉내).
 *
 * 준비(운영 값이 섞이지 않게 로컬 DB·Redis만 가리키는지 먼저 확인한다):
 *   - 서버: `E2E_TEST=1`, `NEXT_PUBLIC_AI_SITE_URL=http://ai.localhost:<port>`, 로컬 Redis(SRH) 연결.
 *   - 게스트 IP 하루 상한(100)을 넘기지 않게 시나리오 사이에 로컬 Redis를 비운다.
 *
 * 실행: `node_modules/.bin/tsx scripts/load/agent-slots.mts --base http://ai.localhost:4300 --scenario S1`
 *   --scenario S1|S2|S3|S4|S5|all   (기본 all)
 *   --minutes <n>                   S5 길이(기본 20)
 *   --hold <ms>                     S2·S3 보류 시간(기본 10000)
 */

const ARGS = new Map<string, string>(
    process.argv
        .slice(2)
        .flatMap((arg, i, all) =>
            arg.startsWith('--') ? [[arg.slice(2), all[i + 1] ?? '']] : []
        )
        .map(([k, v]) => [k, v] as [string, string])
);
const BASE = ARGS.get('base') ?? 'http://ai.localhost:4300';
const ORIGIN = new URL(BASE).origin;
const SCENARIO = ARGS.get('scenario') ?? 'all';
const S5_MINUTES = Number(ARGS.get('minutes') ?? '20');
const HOLD_MS = Number(ARGS.get('hold') ?? '10000');
const USER_AGENT =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

const sleep = (ms: number): Promise<void> =>
    new Promise(resolve => setTimeout(resolve, ms));

type Outcome = 'done' | 'busy' | 'aborted' | 'stream_error' | 'http_error';

interface TurnSpec {
    label: string;
    /** 시나리오 시작으로부터 요청을 보내는 시각(ms). */
    atMs: number;
    message: string;
    /** 시나리오 시작으로부터 이 시각에 연결을 끊는다. */
    abortAtMs?: number;
}

interface TurnResult {
    label: string;
    atMs: number;
    status: number;
    outcome: Outcome;
    /** 응답 첫 바이트까지(ms). 본문이 없으면 응답 헤더까지. */
    ttfbMs: number;
    totalMs: number;
}

/** 게스트 쿠키를 한 개 받는다 — 실제 페이지 조회와 같은 경로(`proxy.ts`가 심는다). */
async function mintGuestCookie(): Promise<string> {
    const res = await fetch(`${BASE}/`, {
        headers: { 'User-Agent': USER_AGENT },
        redirect: 'manual',
    });
    await res.arrayBuffer();
    const cookie = res.headers
        .getSetCookie()
        .map(c => c.split(';')[0])
        .find(c => c.startsWith('siglens_guest='));
    if (!cookie)
        throw new Error(`no siglens_guest cookie (HTTP ${res.status})`);
    return cookie;
}

async function mintMany(n: number): Promise<string[]> {
    const batch = 6;
    return Array.from({ length: Math.ceil(n / batch) }).reduce<
        Promise<string[]>
    >(async (acc, _, i) => {
        const done = await acc;
        const part = await Promise.all(
            Array.from({ length: Math.min(batch, n - i * batch) }, () =>
                mintGuestCookie()
            )
        );
        return [...done, ...part];
    }, Promise.resolve([]));
}

async function runTurn(
    spec: TurnSpec,
    cookie: string,
    t0: number
): Promise<TurnResult> {
    await sleep(Math.max(0, t0 + spec.atMs - Date.now()));
    const controller = new AbortController();
    const abortTimer =
        spec.abortAtMs === undefined
            ? undefined
            : setTimeout(
                  () => controller.abort(),
                  Math.max(0, t0 + spec.abortAtMs - Date.now())
              );
    const started = Date.now();
    const result = (
        status: number,
        outcome: Outcome,
        ttfbMs: number
    ): TurnResult => ({
        label: spec.label,
        atMs: started - t0,
        status,
        outcome,
        ttfbMs,
        totalMs: Date.now() - started,
    });
    try {
        const res = await fetch(`${BASE}/api/ai/chat/stream`, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                Origin: ORIGIN,
                Cookie: cookie,
                'User-Agent': USER_AGENT,
            },
            body: JSON.stringify({
                conversationId: null,
                action: 'send',
                message: spec.message,
                history: [],
                images: [],
            }),
            signal: controller.signal,
        });
        if (!res.ok) {
            await res.arrayBuffer();
            return result(
                res.status,
                res.status === 503 ? 'busy' : 'http_error',
                Date.now() - started
            );
        }
        const reader = res.body?.getReader();
        if (!reader) return result(res.status, 'http_error', 0);
        const decoder = new TextDecoder();
        const firstChunk = await reader.read();
        const ttfbMs = Date.now() - started;
        const drain = async (text: string): Promise<string> => {
            const chunk = await reader.read();
            return chunk.done
                ? text
                : drain(
                      (
                          text + decoder.decode(chunk.value, { stream: true })
                      ).slice(-2_000)
                  );
        };
        const tail = await drain(
            firstChunk.done ? '' : decoder.decode(firstChunk.value)
        );
        return result(
            res.status,
            tail.includes('event: done') ? 'done' : 'stream_error',
            ttfbMs
        );
    } catch (error) {
        const aborted = controller.signal.aborted;
        if (!aborted)
            console.error(`  ${spec.label}: ${(error as Error).name}`);
        return result(0, aborted ? 'aborted' : 'http_error', 0);
    } finally {
        if (abortTimer !== undefined) clearTimeout(abortTimer);
    }
}

async function runScenario(specs: TurnSpec[]): Promise<TurnResult[]> {
    const cookies = await mintMany(specs.length);
    const t0 = Date.now() + 500;
    return Promise.all(specs.map((s, i) => runTurn(s, cookies[i], t0)));
}

const percentile = (values: number[], p: number): number | null => {
    if (values.length === 0) return null;
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
};

const count = (rs: TurnResult[], outcome: Outcome): number =>
    rs.filter(r => r.outcome === outcome).length;

interface Summary {
    scenario: string;
    total: number;
    done: number;
    busy503: number;
    busyRate: string;
    aborted: number;
    otherFailures: number;
    latest503AtMs: number | null;
    latest503WaitMs: number | null;
    busyWaitHistogram: Record<string, number>;
    ttfbP50: number | null;
    ttfbP95: number | null;
}

function summarize(
    scenario: string,
    rs: TurnResult[],
    filter: (r: TurnResult) => boolean = () => true
): Summary {
    const subset = rs.filter(filter);
    const busy = subset.filter(r => r.outcome === 'busy');
    const served = subset.filter(r => r.outcome === 'done');
    const waits = busy.map(r => r.totalMs);
    const bucket = (ms: number): string =>
        ms < 1_000
            ? '<1s (queue_full/immediate)'
            : `${Math.round(ms / 1_000)}s`;
    return {
        scenario,
        total: subset.length,
        done: served.length,
        busy503: busy.length,
        busyRate: `${((busy.length / Math.max(1, subset.length)) * 100).toFixed(1)}%`,
        aborted: count(subset, 'aborted'),
        otherFailures:
            count(subset, 'http_error') + count(subset, 'stream_error'),
        latest503AtMs: busy.length
            ? Math.max(...busy.map(r => r.atMs + r.totalMs))
            : null,
        latest503WaitMs: waits.length ? Math.max(...waits) : null,
        busyWaitHistogram: busy.reduce<Record<string, number>>(
            (acc, r) => ({
                ...acc,
                [bucket(r.totalMs)]: (acc[bucket(r.totalMs)] ?? 0) + 1,
            }),
            {}
        ),
        ttfbP50: percentile(
            served.map(r => r.ttfbMs),
            0.5
        ),
        ttfbP95: percentile(
            served.map(r => r.ttfbMs),
            0.95
        ),
    };
}

const range = (n: number): number[] => Array.from({ length: n }, (_, i) => i);
const hold = (ms: number): string => `[e2e-hold:${ms}]`;

/** S1: 긴 턴 4개가 정원을 쥔 사이 짧은 턴 12개가 1초 간격으로 온다. */
const s1 = (): TurnSpec[] => [
    ...range(4).map(i => ({
        label: `long${i}`,
        atMs: 0,
        message: '[e2e-fresh] 분석해줘',
    })),
    ...range(12).map(i => ({
        label: `short${i}`,
        atMs: 1_000 * (i + 1),
        message: 'AAPL 시세',
    })),
];

/** S2: 30명이 동시에 보류 턴을 연다. */
const s2 = (): TurnSpec[] =>
    range(30).map(i => ({
        label: `burst${i}`,
        atMs: 0,
        message: `${hold(HOLD_MS)} 질문`,
    }));

/** S3: S2 + 줄 선 5명이 2초에 끊는다(줄 맨 앞 5명이 아니라 뒤 순서는 서버가 정하므로 뒤쪽 5명을 끊는다). */
const s3 = (): TurnSpec[] =>
    s2().map((spec, i) =>
        i >= 4 && i < 9
            ? { ...spec, label: `abort${i}`, abortAtMs: 2_000 }
            : spec
    );

/** S4: 새 분석 14개를 5초 안에 올린 뒤 짧은 턴 2개. */
const s4 = (): TurnSpec[] => [
    ...range(14).map(i => ({
        label: `fresh${i}`,
        atMs: Math.round((i * 5_000) / 14),
        message: '[e2e-fresh] 분석해줘',
    })),
    ...range(2).map(i => ({
        label: `short${i}`,
        atMs: 5_500 + i * 200,
        message: 'AAPL 시세',
    })),
];

/** 재현 가능한 의사 난수(mulberry32) — 베이스라인과 비교 실행이 같은 도착 시각을 쓴다. */
const prng = (seed: number): (() => number) => {
    const state = { s: seed };
    return () => {
        state.s = (state.s + 0x6d2b79f5) | 0;
        const t = Math.imul(state.s ^ (state.s >>> 15), 1 | state.s);
        const u = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((u ^ (u >>> 14)) >>> 0) / 4294967296;
    };
};

/** S5: 분당 3건 푸아송 도착, 30%가 새 분석 턴, 나머지는 8초 걸리는 짧은 턴. */
function s5(): TurnSpec[] {
    const rand = prng(20261122);
    const endMs = S5_MINUTES * 60_000;
    const next = (acc: number[]): number[] => {
        const gap = (-Math.log(1 - rand()) / 3) * 60_000;
        const at = (acc.at(-1) ?? 0) + gap;
        return at >= endMs ? acc : next([...acc, at]);
    };
    return next([])
        .map((at, i) => ({
            label: rand() < 0.3 ? `long${i}` : `short${i}`,
            atMs: Math.round(at),
            message: '',
        }))
        .map(spec => ({
            ...spec,
            message: spec.label.startsWith('long')
                ? '[e2e-fresh] 분석해줘'
                : `AAPL 시세 ${hold(8_000)}`,
        }));
}

const SCENARIOS: Record<
    string,
    { build: () => TurnSpec[]; focus?: (r: TurnResult) => boolean }
> = {
    S1: { build: s1, focus: r => r.label.startsWith('short') },
    S2: { build: s2 },
    S3: { build: s3 },
    S4: { build: s4 },
    S5: { build: s5 },
};

async function main(): Promise<void> {
    const names =
        SCENARIO === 'all' ? Object.keys(SCENARIOS) : SCENARIO.split(',');
    const summaries = await names.reduce<Promise<Summary[]>>(
        async (acc, name) => {
            const done = await acc;
            const scenario = SCENARIOS[name];
            if (!scenario) throw new Error(`unknown scenario ${name}`);
            console.error(`running ${name} (${scenario.build().length} turns)`);
            const results = await runScenario(scenario.build());
            const summary = summarize(name, results, scenario.focus);
            console.log(JSON.stringify(summary));
            return [...done, summary];
        },
        Promise.resolve([])
    );
    console.error(`finished ${summaries.length} scenario(s)`);
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
