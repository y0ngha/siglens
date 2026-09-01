import type { CongressSentiment } from '@y0ngha/siglens-core';
import { stripSnapshotMarkdown } from '../lib/stripSnapshotMarkdown';
import { createEnumGuard } from '../lib/createEnumGuard';
import { narrowStringArray } from '../lib/narrowStringArray';

/** CongressSentiment → `shared.enumLabel` 카탈로그 키. 값 자체는 더 이상 한글이 아니다 — 렌더 시점에 `tLabel`로 조회한다. */
export const SENTIMENT_LABEL_KEY: Record<CongressSentiment, string> = {
    bullish: 'congressSentiment.bullish',
    neutral: 'congressSentiment.neutral',
    bearish: 'congressSentiment.bearish',
};

// See createEnumGuard's JSDoc for the Object.hasOwn / prototype-chain
// rationale (audit fix; PR #698 round-2 review FIX 3 extracted the shared
// implementation).
const isSentiment = createEnumGuard(SENTIMENT_LABEL_KEY);

interface NarrowedCongressContent {
    summaryKo: string;
    overallSentiment: CongressSentiment | null;
    notableMembersKo: string[];
    riskNoteKo: string;
}

/**
 * `content`를 congress 결과 모양으로 좁힌다.
 *
 * `summaryKo`(순매매 동향 요약 문단), `notableMembersKo`(주목할 인물 목록),
 * `riskNoteKo`(참고 사항 문단)가 프로즈 소스다. 이 응답은 tier 마스킹을
 * 거치지 않으므로 세 필드 전부 값이 채워질 수 있다.
 */
export function narrowCongressContent(
    content: unknown
): NarrowedCongressContent | null {
    if (typeof content !== 'object' || content === null) return null;

    const record = content as Record<string, unknown>;
    const summaryKo =
        typeof record.summaryKo === 'string'
            ? stripSnapshotMarkdown(record.summaryKo).trim()
            : '';
    const overallSentiment = isSentiment(record.overallSentiment)
        ? record.overallSentiment
        : null;

    const notableMembersKo = narrowStringArray(record.notableMembersKo);

    const riskNoteKo =
        typeof record.riskNoteKo === 'string'
            ? stripSnapshotMarkdown(record.riskNoteKo).trim()
            : '';

    if (
        summaryKo.length === 0 &&
        notableMembersKo.length === 0 &&
        riskNoteKo.length === 0
    ) {
        return null;
    }

    return { summaryKo, overallSentiment, notableMembersKo, riskNoteKo };
}

/**
 * `congress/page.tsx`가 `<CongressSnapshotProse>`를 렌더할지 아니면 클라이언트
 * AI 위젯(`CongressTrendSummary`)을 렌더할지 판단하는 예측기(audit fix FIX 2 —
 * `OverallSnapshotProse.hasOverallProse`가 세운 패턴). 두 소스가 같은 필드
 * (`summaryKo`/`notableMembersKo`/`riskNoteKo`)를 같은 순서로 중복 렌더하던
 * 문제를 XOR 게이팅으로 해소한다 — 프로즈가 렌더 가능하면 그것만 보여주고,
 * 위젯은 프로즈가 없을 때만 폴백으로 마운트한다.
 *
 * `narrowCongressContent`를 그대로 재사용해 이 예측기와 컴포넌트가 서로 다른
 * 판단을 내릴 수 없게 한다(단일 진실 소스).
 */
export function hasCongressProse(content: unknown): boolean {
    return narrowCongressContent(content) !== null;
}
