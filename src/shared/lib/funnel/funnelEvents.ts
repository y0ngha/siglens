import type { SignupNudgeVariant } from '@/shared/lib/anonAnalysisCount';

/**
 * 가입 퍼널 이벤트 카탈로그 — 닫힌 유니언. 추가는 스펙
 * (`docs/superpowers/specs/2026-10-09-funnel-events-design.md` §3.3) 갱신과 함께.
 *
 * 검색어·URL·자유 문장은 어떤 context에도 넣지 않는다. 400일 보관되는 테이블이라
 * 한 번 섞이면 방침(§1 "서비스 이용 행태")이 거짓이 된다. `isFunnelEventPayload`가
 * 여분 키를 거부하는 이유다.
 */

/** 넛지 종류 — 모달이 뜨는 것만. */
export const FUNNEL_NUDGE_KINDS = [
    'anon_auto',
    'reasoning_toggle',
    'rate_limit',
    'model_gate',
    'member_setup',
    'member_symbol',
] as const;
export type FunnelNudgeKind = (typeof FUNNEL_NUDGE_KINDS)[number];

/** 잠긴 요소 클릭 — 모달 없이 가입 페이지로 가거나 모달을 **여는** 클릭. */
export const FUNNEL_GATES = [
    'timeframe',
    'model',
    'locked_detail',
    'reasoning_toggle',
    'portfolio_page',
] as const;
export type FunnelGate = (typeof FUNNEL_GATES)[number];

/** 비회원이 마지막으로 누른 것 — 게이트거나 넛지 종류. */
export type FunnelLastGate = FunnelGate | FunnelNudgeKind;
export const FUNNEL_LAST_GATES: readonly FunnelLastGate[] = [
    ...FUNNEL_GATES,
    ...FUNNEL_NUDGE_KINDS,
];

export const FUNNEL_NUDGE_CTAS = [
    'signup',
    'login',
    'settings',
    'add',
] as const;
export type FunnelNudgeCta = (typeof FUNNEL_NUDGE_CTAS)[number];

export const SIGNUP_METHODS = ['email', 'oauth'] as const;
export type SignupMethod = (typeof SIGNUP_METHODS)[number];

/** 2편·3편(관심종목·메일 리포트)이 보낸다. 지금은 카탈로그만 둔다. */
export const WATCHLIST_SOURCES = [
    'home_onboarding',
    'symbol_header',
    'portfolio_page',
    'nudge',
] as const;
export type WatchlistSource = (typeof WATCHLIST_SOURCES)[number];
/** 병합 한 번에 들어올 수 있는 종목 수 상한 — 관심종목 상한보다 넉넉히. */
export const WATCHLIST_MERGE_MAX = 1000;

export const REPORT_ENABLED_SOURCES = ['settings', 'nudge'] as const;
export type ReportEnabledSource = (typeof REPORT_ENABLED_SOURCES)[number];

/**
 * `variant`는 `anon_auto`에만 붙는다 — 자동 넛지만 문구를 번갈아 쓴다. `Record`라
 * `SignupNudgeVariant`에 값이 늘면 여기서 컴파일 오류로 드러난다.
 */
const NUDGE_VARIANT_SET: Record<SignupNudgeVariant, true> = {
    reasoning: true,
    emailReport: true,
};
export const FUNNEL_NUDGE_VARIANTS = Object.keys(
    NUDGE_VARIANT_SET
) as readonly SignupNudgeVariant[];

export interface FunnelContextByEvent {
    nudge_shown: { kind: FunnelNudgeKind; variant?: SignupNudgeVariant };
    nudge_clicked: {
        kind: FunnelNudgeKind;
        variant?: SignupNudgeVariant;
        cta: FunnelNudgeCta;
    };
    gate_clicked: { gate: FunnelGate };
    signup_completed: { method: SignupMethod; lastGate: FunnelLastGate | null };
    watchlist_added: { source: WatchlistSource };
    watchlist_merged: { count: number };
    report_enabled: { source: ReportEnabledSource };
}
export type FunnelEvent = keyof FunnelContextByEvent;
export type ContextOf<E extends FunnelEvent> = FunnelContextByEvent[E];
/** DB `context` 컬럼의 타입 — 모든 이벤트 context의 유니언. */
export type FunnelEventContext = FunnelContextByEvent[FunnelEvent];
export type FunnelEventPayload = {
    [E in FunnelEvent]: { event: E; context: ContextOf<E> };
}[FunnelEvent];

const EVENT_SET: Record<FunnelEvent, true> = {
    nudge_shown: true,
    nudge_clicked: true,
    gate_clicked: true,
    signup_completed: true,
    watchlist_added: true,
    watchlist_merged: true,
    report_enabled: true,
};
export const FUNNEL_EVENTS = Object.keys(EVENT_SET) as readonly FunnelEvent[];

/**
 * 라우트가 받는 본문 전체의 상한(바이트). 유효한 context는 100바이트를 넘지 않으므로
 * 1KB면 넉넉하다 — 이보다 크면 JSON.parse 전에 거른다(`SERVER.md#SA-7`).
 */
export const FUNNEL_BODY_MAX_BYTES = 1024;

function isOneOf<T extends string>(
    values: readonly T[],
    value: unknown
): value is T {
    return (
        typeof value === 'string' &&
        (values as readonly string[]).includes(value)
    );
}

function hasOnlyKeys(
    record: Record<string, unknown>,
    allowed: readonly string[]
): boolean {
    return Object.keys(record).every(key => allowed.includes(key));
}

function isNudgeKindContext(ctx: Record<string, unknown>): boolean {
    if (!isOneOf(FUNNEL_NUDGE_KINDS, ctx.kind)) return false;
    if (ctx.variant === undefined) return true;
    return (
        ctx.kind === 'anon_auto' && isOneOf(FUNNEL_NUDGE_VARIANTS, ctx.variant)
    );
}

const CONTEXT_VALIDATORS: {
    [E in FunnelEvent]: (ctx: Record<string, unknown>) => boolean;
} = {
    nudge_shown: ctx =>
        hasOnlyKeys(ctx, ['kind', 'variant']) && isNudgeKindContext(ctx),
    nudge_clicked: ctx =>
        hasOnlyKeys(ctx, ['kind', 'variant', 'cta']) &&
        isNudgeKindContext(ctx) &&
        isOneOf(FUNNEL_NUDGE_CTAS, ctx.cta),
    gate_clicked: ctx =>
        hasOnlyKeys(ctx, ['gate']) && isOneOf(FUNNEL_GATES, ctx.gate),
    signup_completed: ctx =>
        hasOnlyKeys(ctx, ['method', 'lastGate']) &&
        isOneOf(SIGNUP_METHODS, ctx.method) &&
        (ctx.lastGate === null || isOneOf(FUNNEL_LAST_GATES, ctx.lastGate)),
    watchlist_added: ctx =>
        hasOnlyKeys(ctx, ['source']) && isOneOf(WATCHLIST_SOURCES, ctx.source),
    watchlist_merged: ctx =>
        hasOnlyKeys(ctx, ['count']) &&
        Number.isInteger(ctx.count) &&
        (ctx.count as number) >= 0 &&
        (ctx.count as number) <= WATCHLIST_MERGE_MAX,
    report_enabled: ctx =>
        hasOnlyKeys(ctx, ['source']) &&
        isOneOf(REPORT_ENABLED_SOURCES, ctx.source),
};

/** 라우트 입력 검증. 모르는 event·여분 키·잘못된 enum은 전부 거부한다. */
export function isFunnelEventPayload(
    value: unknown
): value is FunnelEventPayload {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return false;
    }
    const record = value as Record<string, unknown>;
    if (!hasOnlyKeys(record, ['event', 'context'])) return false;
    const { event, context } = record;
    if (!isOneOf(FUNNEL_EVENTS, event)) return false;
    if (
        typeof context !== 'object' ||
        context === null ||
        Array.isArray(context)
    ) {
        return false;
    }
    return CONTEXT_VALIDATORS[event](context as Record<string, unknown>);
}
