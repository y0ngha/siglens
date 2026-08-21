import type { ShareableKind } from '../types';

export interface OgText {
    description: string;
    tweet: string;
}

const TWEET_TEXT_MAX = 180;

/**
 * 방향성 → `entities.shared-analysis.og` 메시지 키.
 *
 * 표시 문자열이 아니다 — 공유 카드의 OG description·트윗 문안이 여기서 나오는데
 * 한국어로 굳으면 `/en/share/…`가 영어 제목 아래 한국어 방향성을 실어 보낸다.
 * 요약문(`summary`)은 저장된 AI 산출물이라 여기서 바꿀 수 없다.
 */
const DIRECTION_KEY: Record<string, string> = {
    bullish: 'bullish',
    bearish: 'bearish',
    neutral: 'neutral',
    cautious: 'cautious',
};

/** `entities.shared-analysis.og` 번역자. */
export type OgTranslator = (
    key: string,
    values?: Record<string, string | number>
) => string;

function firstLine(text: string): string {
    return text.split('\n')[0]?.trim() ?? '';
}

function clamp(text: string, max: number): string {
    return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

function majorityName(
    scenarios: ReadonlyArray<{ name?: string }> | undefined
): string {
    if (!scenarios?.length) return 'neutral';
    const counts = new Map<string, number>();
    for (const s of scenarios) {
        if (s.name) counts.set(s.name, (counts.get(s.name) ?? 0) + 1);
    }
    let best = 'neutral';
    let bestN = -1;
    for (const [name, n] of counts) {
        if (n > bestN) {
            best = name;
            bestN = n;
        }
    }
    return best;
}

function buildOgParts(
    symbol: string,
    direction: string,
    summary: string,
    t: OgTranslator
): OgText {
    // 알 수 없는 방향성은 원문 그대로 — 저장된 스냅샷에 새 값이 들어와도
    // 빈 문자열이 되지 않게 한다.
    const key = DIRECTION_KEY[direction];
    const dir = key ? t(key) : direction;
    const description = clamp(summary ? `${dir} · ${summary}` : dir, 200);
    const tweet = clamp(`${symbol} ${dir} — ${summary}`, TWEET_TEXT_MAX);
    return { description, tweet };
}

/**
 * Per-kind builder map. Each entry extracts direction + summary from a raw result
 * object and returns `{ description, tweet }`.
 *
 * Typed with `satisfies Record<ShareableKind, ...>` so TypeScript enforces
 * compile-time exhaustiveness: adding a new kind to `ShareableKind` without
 * a corresponding builder here is a compile error. See spec §6-1 / §6-3.
 */
export const SHARE_KIND_OG_BUILDERS = {
    chart: (
        r: Record<string, unknown>,
        symbol: string,
        t: OgTranslator
    ): OgText => {
        const direction = String(r.trend ?? 'neutral');
        const summary = firstLine(String(r.summary ?? ''));
        return buildOgParts(symbol, direction, summary, t);
    },

    overall: (
        r: Record<string, unknown>,
        symbol: string,
        t: OgTranslator
    ): OgText => {
        const direction = majorityName(
            // r.scenarios is validated as an object array by isValidShareInput at write
            // time; the cast narrows the opaque Record value to the expected shape.
            r.scenarios as { name?: string }[] | undefined
        );
        const summary = firstLine(
            String(r.headlineKo ?? r.integratedConclusionKo ?? '')
        );
        return buildOgParts(symbol, direction, summary, t);
    },

    news: (
        r: Record<string, unknown>,
        symbol: string,
        t: OgTranslator
    ): OgText => {
        const direction = String(r.overallSentiment ?? 'neutral');
        const summary = firstLine(String(r.currentDriverKo ?? ''));
        return buildOgParts(symbol, direction, summary, t);
    },

    fundamental: (
        r: Record<string, unknown>,
        symbol: string,
        t: OgTranslator
    ): OgText => {
        const direction = String(r.overallSentiment ?? 'neutral');
        const summary = firstLine(String(r.overallConclusionKo ?? ''));
        return buildOgParts(symbol, direction, summary, t);
    },

    financials: (
        r: Record<string, unknown>,
        symbol: string,
        t: OgTranslator
    ): OgText => {
        const direction = String(r.overallSentiment ?? 'neutral');
        const summary = firstLine(String(r.overallConclusionKo ?? ''));
        return buildOgParts(symbol, direction, summary, t);
    },

    congress: (
        r: Record<string, unknown>,
        symbol: string,
        t: OgTranslator
    ): OgText => {
        const direction = String(r.overallSentiment ?? 'neutral');
        const summary = firstLine(String(r.summaryKo ?? ''));
        return buildOgParts(symbol, direction, summary, t);
    },

    options: (
        r: Record<string, unknown>,
        symbol: string,
        t: OgTranslator
    ): OgText => {
        // r.signals is a validated object array from the server-written snapshot;
        // the cast narrows the opaque Record value to the expected shape.
        const signals = (r.signals as { kind?: string }[] | undefined) ?? [];
        const direction = signals[0]?.kind ?? String(r.tone ?? 'neutral');
        const summary = firstLine(String(r.summary ?? ''));
        return buildOgParts(symbol, direction, summary, t);
    },

    'fear-greed': (
        r: Record<string, unknown>,
        symbol: string,
        t: OgTranslator
    ): OgText => {
        const direction = String(r.label ?? 'NEUTRAL');
        const summary = t('fearGreedSummary', { v0: String(r.score ?? '') });
        return buildOgParts(symbol, direction, summary, t);
    },
} satisfies Record<
    ShareableKind,
    (r: Record<string, unknown>, symbol: string, t: OgTranslator) => OgText
>;
