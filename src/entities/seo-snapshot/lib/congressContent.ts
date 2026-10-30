import type { CongressSentiment } from '@y0ngha/siglens-core';
import { createEnumGuard } from './createEnumGuard';
import { asRecord, narrowCleanString } from './narrowJson';
import { narrowStringArray } from './narrowStringArray';

/** CongressSentiment → `shared.enumLabel` 카탈로그 키. 렌더 시점에 `tLabel`로 조회한다. */
export const SENTIMENT_LABEL_KEY: Record<CongressSentiment, string> = {
    bullish: 'congressSentiment.bullish',
    neutral: 'congressSentiment.neutral',
    bearish: 'congressSentiment.bearish',
};

// `Object.hasOwn`으로 거르는 이유는 `createEnumGuard` JSDoc 참고.
const isSentiment = createEnumGuard(SENTIMENT_LABEL_KEY);

interface NarrowedCongressContent {
    summaryKo: string;
    overallSentiment: CongressSentiment | null;
    notableMembersKo: string[];
    riskNoteKo: string;
}

/**
 * `content`를 congress 결과 모양으로 좁힌다. 산문 근거가 전혀 없으면 `null`.
 *
 * `summaryKo`(순매매 동향 요약 문단), `notableMembersKo`(주목할 인물 목록), `riskNoteKo`(참고
 * 사항 문단)가 산문 소스다. 이 응답은 tier 마스킹을 거치지 않으므로 세 필드 전부 값이 채워질
 * 수 있다.
 */
export function narrowCongressContent(
    content: unknown
): NarrowedCongressContent | null {
    const record = asRecord(content);
    if (record === null) return null;

    const summaryKo = narrowCleanString(record.summaryKo);
    const overallSentiment = isSentiment(record.overallSentiment)
        ? record.overallSentiment
        : null;

    const notableMembersKo = narrowStringArray(record.notableMembersKo);

    const riskNoteKo = narrowCleanString(record.riskNoteKo);

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
 * `congress/page.tsx`가 `<CongressSnapshotProse>`를 렌더할지 아니면 클라이언트 AI 위젯
 * (`CongressTrendSummary`)을 렌더할지 판단하는 예측기. 산문이 렌더 가능하면 그것만 보여주고
 * 위젯은 산문이 없을 때만 폴백으로 마운트해, 같은 필드(`summaryKo`/`notableMembersKo`/
 * `riskNoteKo`)가 중복 렌더되지 않는다. 렌더러와 같은 `narrowCongressContent`를 쓰므로 둘이
 * 서로 다른 판단을 내릴 수 없다.
 */
export function hasCongressProse(content: unknown): boolean {
    return narrowCongressContent(content) !== null;
}
