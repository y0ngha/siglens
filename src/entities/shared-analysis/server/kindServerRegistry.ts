import type { FearGreedLabel, OptionsSignalKind } from '@y0ngha/siglens-core';
import { truncateWithEllipsis } from '@/shared/lib/truncate';
import { isRecord } from '@/shared/lib/isRecord';
import type { ShareableKind } from '../types';

/** OG 메타 description과 트윗 문안 한 쌍 — `buildOgText`가 돌려주고 공유 페이지 메타·OG 이미지가 쓴다. */
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
const DIRECTION_KEY: Readonly<Record<string, string>> = {
    bullish: 'bullish',
    bearish: 'bearish',
    neutral: 'neutral',
    cautious: 'cautious',
    // 옵션 `signals[].kind` — bullish/bearish/neutral은 위와 같다. 빠지면
    // `volatility`가 원문 그대로 OG 설명·트윗에 찍혔다.
    ...({ volatility: 'volatility' } satisfies Record<
        Exclude<OptionsSignalKind, 'bullish' | 'bearish' | 'neutral'>,
        string
    >),
    // 공포·탐욕 `label`. 빠지면 `EXTREME_FEAR` 같은 enum이 전 로케일에 찍혔다.
    ...({
        EXTREME_FEAR: 'extremeFear',
        FEAR: 'fear',
        NEUTRAL: 'neutral',
        GREED: 'greed',
        EXTREME_GREED: 'extremeGreed',
    } satisfies Record<FearGreedLabel, string>),
};

/** `entities.shared-analysis.og` 번역자. */
export type OgTranslator = (
    key: string,
    values?: Record<string, string | number>
) => string;

function firstLine(text: string): string {
    return text.split('\n')[0]?.trim() ?? '';
}

/**
 * 시나리오 배열에서 `name` 문자열만 뽑는다. `result`는 객체인지만 검증된 jsonb라
 * `scenarios`가 배열이 아니거나 원소가 null일 수 있고, 그대로 순회하면 메타 생성이
 * 던져 해당 공유 페이지가 500이 된다. 문자열이 아닌 `name`은 깨진 저장값으로 보고
 * 의도적으로 무시한다.
 */
function scenarioNames(scenarios: unknown): string[] {
    if (!Array.isArray(scenarios)) return [];
    return scenarios
        .map(s => (isRecord(s) ? s.name : undefined))
        .filter((name): name is string => typeof name === 'string' && !!name);
}

/**
 * 옵션 `signals`의 첫 원소 `kind`. 배열이 아니거나 원소 형태가 다르거나 `kind`가
 * 문자열이 아니면(깨진 저장값으로 보고 의도적으로 무시) undefined — 호출부가 tone으로 폴백한다.
 */
function firstSignalKind(signals: unknown): string | undefined {
    if (!Array.isArray(signals)) return undefined;
    const first: unknown = signals[0];
    return isRecord(first) && typeof first.kind === 'string'
        ? first.kind
        : undefined;
}

function majorityName(names: readonly string[]): string {
    if (names.length === 0) return 'neutral';
    const counts = new Map<string, number>();
    for (const name of names) {
        counts.set(name, (counts.get(name) ?? 0) + 1);
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
    const description = truncateWithEllipsis(
        summary ? `${dir}: ${summary}` : dir,
        200
    );
    const tweet = truncateWithEllipsis(
        `${symbol} ${dir}: ${summary}`,
        TWEET_TEXT_MAX
    );
    return { description, tweet };
}

/**
 * kind별 OG 문안 빌더 맵. 각 항목은 저장된 result 객체에서 방향성과 요약을 뽑아
 * `{ description, tweet }`을 만든다. `buildOgText`가 kind로 디스패치한다.
 *
 * `satisfies Record<ShareableKind, ...>`로 컴파일 시점에 빠짐없음을 강제한다 —
 * `ShareableKind`에 kind를 추가하고 여기에 빌더를 넣지 않으면 컴파일 에러다.
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
        const direction = majorityName(scenarioNames(r.scenarios));
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
        const direction =
            firstSignalKind(r.signals) ?? String(r.tone ?? 'neutral');
        const summary = firstLine(String(r.summary ?? ''));
        return buildOgParts(symbol, direction, summary, t);
    },

    'fear-greed': (
        r: Record<string, unknown>,
        symbol: string,
        t: OgTranslator
    ): OgText => {
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
                ? t('fearGreedSummary', { v0: String(Math.round(rawScore)) })
                : t('fearGreedSummaryNoScore');
        return buildOgParts(symbol, direction, summary, t);
    },
} satisfies Record<
    ShareableKind,
    (r: Record<string, unknown>, symbol: string, t: OgTranslator) => OgText
>;
