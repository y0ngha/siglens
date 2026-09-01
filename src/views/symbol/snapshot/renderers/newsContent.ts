import type { NewsSentiment } from '@y0ngha/siglens-core';
import { stripSnapshotMarkdown } from '../lib/stripSnapshotMarkdown';
import { createEnumGuard } from '../lib/createEnumGuard';
import { narrowStringArray } from '../lib/narrowStringArray';

/** NewsSentiment → `shared.enumLabel` 카탈로그 키. 값 자체는 더 이상 한글이 아니다 — 렌더 시점에 `tLabel`로 조회한다. */
export const SENTIMENT_LABEL_KEY: Record<NewsSentiment, string> = {
    bullish: 'sentiment.bullish',
    neutral: 'sentiment.neutral',
    bearish: 'sentiment.bearish',
};

// See createEnumGuard's JSDoc for the Object.hasOwn / prototype-chain
// rationale (audit fix; PR #698 round-2 review FIX 3 extracted the shared
// implementation).
const isSentiment = createEnumGuard(SENTIMENT_LABEL_KEY);

interface NarrowedNewsContent {
    currentDriverKo: string;
    overallSentiment: NewsSentiment | null;
    keyEventsKo: string[];
    upcomingEventsKo: string[];
}

/**
 * `content`를 news 결과 모양으로 좁힌다.
 *
 * `currentDriverKo`(현재 가격 동인 설명 문단), `keyEventsKo`(핵심 이벤트
 * 목록), `upcomingEventsKo`(다가오는 주요 일정 목록)가 프로즈 소스다. 이
 * 응답은 tier 마스킹을 거치지 않으므로 세 필드 전부 값이 채워질 수 있다.
 */
export function narrowNewsContent(
    content: unknown
): NarrowedNewsContent | null {
    if (typeof content !== 'object' || content === null) return null;

    const record = content as Record<string, unknown>;
    const currentDriverKo =
        typeof record.currentDriverKo === 'string'
            ? stripSnapshotMarkdown(record.currentDriverKo).trim()
            : '';
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
 * `news/page.tsx`가 `<NewsSnapshotProse>`를 렌더할지 아니면 클라이언트 AI
 * 위젯(`NewsAiSummary`)을 렌더할지 판단하는 예측기(audit fix FIX 2 —
 * `OverallSnapshotProse.hasOverallProse` 패턴). 두 소스가 같은 필드
 * (currentDriverKo/keyEventsKo/upcomingEventsKo)를 같은 순서로 중복 렌더하던
 * 문제를 XOR 게이팅으로 해소한다. (결정론적 `NewsFactsSummary`는 이 게이트
 * 대상이 아니다 — AI 결론이 아니라 DB 뉴스 목록 사실이라 중복이 아니다.)
 *
 * `narrowNewsContent`를 그대로 재사용해 이 예측기와 컴포넌트가 서로 다른
 * 판단을 내릴 수 없게 한다(단일 진실 소스).
 */
export function hasNewsProse(content: unknown): boolean {
    return narrowNewsContent(content) !== null;
}
