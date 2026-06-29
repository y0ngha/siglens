import type { SharedAnalysisSnapshot, ShareableKind } from '../types';

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

export interface OgText {
    description: string;
    tweet: string;
}

/** kind별 방향성+요약 텍스트. 스펙 §6-1 필드 매핑. */
export function buildOgText(snapshot: SharedAnalysisSnapshot): OgText {
    const r = snapshot.result as Record<string, unknown>;
    let direction = 'neutral';
    let summary = '';

    const kind = snapshot.kind as ShareableKind;
    switch (kind) {
        case 'chart':
            direction = String(r.trend ?? 'neutral');
            summary = firstLine(String(r.summary ?? ''));
            break;
        case 'overall':
            direction = majorityName(
                r.scenarios as { name?: string }[] | undefined
            );
            summary = firstLine(
                String(r.headlineKo ?? r.integratedConclusionKo ?? '')
            );
            break;
        case 'news':
            direction = String(r.overallSentiment ?? 'neutral');
            summary = firstLine(String(r.currentDriverKo ?? ''));
            break;
        case 'fundamental':
            direction = String(r.overallSentiment ?? 'neutral');
            summary = firstLine(String(r.overallConclusionKo ?? ''));
            break;
        case 'financials':
            direction = String(r.overallSentiment ?? 'neutral');
            summary = firstLine(String(r.overallConclusionKo ?? ''));
            break;
        case 'congress':
            direction = String(r.overallSentiment ?? 'neutral');
            summary = firstLine(String(r.summaryKo ?? ''));
            break;
        case 'options': {
            const signals =
                (r.signals as { kind?: string }[] | undefined) ?? [];
            direction = signals[0]?.kind ?? String(r.tone ?? 'neutral');
            summary = firstLine(String(r.summary ?? ''));
            break;
        }
        case 'fear-greed':
            direction = String(r.label ?? 'NEUTRAL');
            summary = `공포·탐욕 지수 ${String(r.score ?? '')}`;
            break;
    }

    const dirKo = DIRECTION_KO[direction] ?? direction;
    const description = clamp(summary ? `${dirKo} · ${summary}` : dirKo, 200);
    const tweet = clamp(
        `${snapshot.symbol} ${dirKo} — ${summary}`,
        TWEET_TEXT_MAX
    );
    return { description, tweet };
}
