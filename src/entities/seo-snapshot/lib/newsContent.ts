import type { NewsSentiment } from '@y0ngha/siglens-core';
import { createEnumGuard } from './createEnumGuard';
import { asRecord, narrowCleanString } from './narrowJson';
import { narrowStringArray } from './narrowStringArray';

/** NewsSentiment → `shared.enumLabel` 카탈로그 키. 렌더 시점에 `tLabel`로 조회한다. */
export const SENTIMENT_LABEL_KEY: Record<NewsSentiment, string> = {
    bullish: 'sentiment.bullish',
    neutral: 'sentiment.neutral',
    bearish: 'sentiment.bearish',
};

// `Object.hasOwn`으로 거르는 이유는 `createEnumGuard` JSDoc 참고.
const isSentiment = createEnumGuard(SENTIMENT_LABEL_KEY);

interface NarrowedNewsContent {
    currentDriverKo: string;
    overallSentiment: NewsSentiment | null;
    keyEventsKo: string[];
    upcomingEventsKo: string[];
}

/**
 * `content`를 news 결과 모양으로 좁힌다. 산문 근거가 전혀 없으면 `null`.
 *
 * `currentDriverKo`(현재 가격 동인 설명 문단), `keyEventsKo`(핵심 이벤트 목록),
 * `upcomingEventsKo`(다가오는 주요 일정 목록)가 산문 소스다. 이 응답은 tier 마스킹을 거치지
 * 않으므로 세 필드 전부 값이 채워질 수 있다.
 */
export function narrowNewsContent(
    content: unknown
): NarrowedNewsContent | null {
    const record = asRecord(content);
    if (record === null) return null;

    const currentDriverKo = narrowCleanString(record.currentDriverKo);
    const overallSentiment = isSentiment(record.overallSentiment)
        ? record.overallSentiment
        : null;

    const keyEventsKo = narrowStringArray(record.keyEventsKo);
    const upcomingEventsKo = narrowStringArray(record.upcomingEventsKo);

    if (
        currentDriverKo.length === 0 &&
        keyEventsKo.length === 0 &&
        upcomingEventsKo.length === 0
    ) {
        return null;
    }

    return { currentDriverKo, overallSentiment, keyEventsKo, upcomingEventsKo };
}

/**
 * `news/page.tsx`가 `<NewsSnapshotProse>`를 렌더할지 아니면 클라이언트 AI 위젯
 * (`NewsAiSummary`)을 렌더할지 판단하는 예측기. 두 소스가 같은 필드
 * (currentDriverKo/keyEventsKo/upcomingEventsKo)를 중복 렌더하지 않도록 XOR로 게이팅한다.
 * (결정론적 `NewsFactsSummary`는 AI 결론이 아니라 DB 뉴스 목록 사실이라 이 게이트 대상이 아니다.)
 * 렌더러와 같은 `narrowNewsContent`를 쓰므로 둘이 서로 다른 판단을 내릴 수 없다.
 */
export function hasNewsProse(content: unknown): boolean {
    return narrowNewsContent(content) !== null;
}
