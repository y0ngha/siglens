import type { ShareableKind } from '../types';

export interface OgText {
    description: string;
    tweet: string;
}

const TWEET_TEXT_MAX = 180;

const DIRECTION_KO: Record<string, string> = {
    bullish: '강세',
    bearish: '약세',
    neutral: '중립',
    cautious: '주의',
};

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
    summary: string
): OgText {
    const dirKo = DIRECTION_KO[direction] ?? direction;
    const description = clamp(summary ? `${dirKo} · ${summary}` : dirKo, 200);
    const tweet = clamp(`${symbol} ${dirKo} — ${summary}`, TWEET_TEXT_MAX);
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
    chart: (r: Record<string, unknown>, symbol: string): OgText => {
        const direction = String(r.trend ?? 'neutral');
        const summary = firstLine(String(r.summary ?? ''));
        return buildOgParts(symbol, direction, summary);
    },

    overall: (r: Record<string, unknown>, symbol: string): OgText => {
        const direction = majorityName(
            r.scenarios as { name?: string }[] | undefined
        );
        const summary = firstLine(
            String(r.headlineKo ?? r.integratedConclusionKo ?? '')
        );
        return buildOgParts(symbol, direction, summary);
    },

    news: (r: Record<string, unknown>, symbol: string): OgText => {
        const direction = String(r.overallSentiment ?? 'neutral');
        const summary = firstLine(String(r.currentDriverKo ?? ''));
        return buildOgParts(symbol, direction, summary);
    },

    fundamental: (r: Record<string, unknown>, symbol: string): OgText => {
        const direction = String(r.overallSentiment ?? 'neutral');
        const summary = firstLine(String(r.overallConclusionKo ?? ''));
        return buildOgParts(symbol, direction, summary);
    },

    financials: (r: Record<string, unknown>, symbol: string): OgText => {
        const direction = String(r.overallSentiment ?? 'neutral');
        const summary = firstLine(String(r.overallConclusionKo ?? ''));
        return buildOgParts(symbol, direction, summary);
    },

    congress: (r: Record<string, unknown>, symbol: string): OgText => {
        const direction = String(r.overallSentiment ?? 'neutral');
        const summary = firstLine(String(r.summaryKo ?? ''));
        return buildOgParts(symbol, direction, summary);
    },

    options: (r: Record<string, unknown>, symbol: string): OgText => {
        const signals = (r.signals as { kind?: string }[] | undefined) ?? [];
        const direction = signals[0]?.kind ?? String(r.tone ?? 'neutral');
        const summary = firstLine(String(r.summary ?? ''));
        return buildOgParts(symbol, direction, summary);
    },

    'fear-greed': (r: Record<string, unknown>, symbol: string): OgText => {
        const direction = String(r.label ?? 'NEUTRAL');
        const summary = `공포·탐욕 지수 ${String(r.score ?? '')}`;
        return buildOgParts(symbol, direction, summary);
    },
} satisfies Record<
    ShareableKind,
    (r: Record<string, unknown>, symbol: string) => OgText
>;
