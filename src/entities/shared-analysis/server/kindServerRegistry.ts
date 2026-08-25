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
            // r.scenarios is validated as an object array by isValidShareInput at write
            // time; the cast narrows the opaque Record value to the expected shape.
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
        // r.signals is a validated object array from the server-written snapshot;
        // the cast narrows the opaque Record value to the expected shape.
        const signals = (r.signals as { kind?: string }[] | undefined) ?? [];
        const direction = signals[0]?.kind ?? String(r.tone ?? 'neutral');
        const summary = firstLine(String(r.summary ?? ''));
        return buildOgParts(symbol, direction, summary);
    },

    'fear-greed': (r: Record<string, unknown>, symbol: string): OgText => {
        const direction = String(r.label ?? 'NEUTRAL');
        // 점수는 반올림해서 내보낸다. 원시값이 그대로 나가면 공유 링크 unfurl
        // 설명이 `공포·탐욕 지수 42.73276474769012`가 되고, 같은 페이지 본문은
        // `43`을 보여줘 서로 어긋난다(실측). 화면 컴포넌트들은 이미
        // `Math.round`를 쓰고 있어 메타만 예외였다.
        // 숫자 문자열도 받는다. `result`는 jsonb라 지금은 숫자로 돌아오지만,
        // 이전 코드(`String(r.score ?? '')`)는 값이 무엇이든 보여줬으므로 숫자만
        // 받도록 좁히면 그 경우 화면에서 점수가 조용히 사라진다 — 반올림하려다
        // 정보를 잃는 쪽이 더 나쁜 회귀다.
        // 빈 문자열·공백은 강제 변환 대상에서 뺀다. `Number('')`와 `Number('  ')`가
        // **0**이고 `Number.isFinite(0)`은 true라, 그냥 변환하면 폴백에 못 가고
        // `공포·탐욕 지수 0`이라는 없는 점수를 지어낸다. 상류 `isValidShareInput`은
        // `result`가 객체이고 65,536바이트 미만인지만 보므로 빈 문자열도 유효 입력이다.
        const rawScore =
            typeof r.score === 'string' && r.score.trim() !== ''
                ? Number(r.score)
                : r.score;
        const summary =
            typeof rawScore === 'number' && Number.isFinite(rawScore)
                ? `공포·탐욕 지수 ${Math.round(rawScore)}`
                : '공포·탐욕 지수';
        return buildOgParts(symbol, direction, summary);
    },
} satisfies Record<
    ShareableKind,
    (r: Record<string, unknown>, symbol: string) => OgText
>;
