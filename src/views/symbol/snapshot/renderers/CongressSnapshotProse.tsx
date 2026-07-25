import type { CongressSentiment } from '@y0ngha/siglens-core';
import { SnapshotSummarySection } from '../SnapshotSummarySection';

interface CongressSnapshotProseProps {
    /**
     * `seo_analysis_snapshots.content` — 저장소에는 `unknown`으로 보관된다
     * (harvest.ts가 core `prewarmCongress`(→`submitCongressTrend`)의
     * `status==='cached'` 분기에서 얻은 `result.result: CongressTrendResponse`를
     * 그대로 저장, `src/entities/analysis/lib/prewarmSubmits.ts`). 여기서 다시
     * 방어적으로 좁힌다.
     *
     * congress는 FMP의 공개 의회 거래 공시 데이터를 요약한 결과라 애초에
     * BYOK 게이트도 없다(`prewarmCongress` 주석 참고). `submitCongressTrend.js`도
     * `tier`를 스킬 샘플링·캐시 키에만 사용할 뿐 응답 필드를 tier로 마스킹하는
     * 코드 경로가 없어, free tier로 pre-warm해도 전 필드가 그대로 채워진다.
     */
    content: unknown;
    symbol: string;
    displayName: string;
}

const SENTIMENT_LABEL: Record<CongressSentiment, string> = {
    bullish: '매수 우위',
    neutral: '중립',
    bearish: '매도 우위',
};

function isSentiment(value: unknown): value is CongressSentiment {
    return typeof value === 'string' && value in SENTIMENT_LABEL;
}

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
function narrowCongressContent(
    content: unknown
): NarrowedCongressContent | null {
    if (typeof content !== 'object' || content === null) return null;

    const record = content as Record<string, unknown>;
    const summaryKo =
        typeof record.summaryKo === 'string' ? record.summaryKo.trim() : '';
    const overallSentiment = isSentiment(record.overallSentiment)
        ? record.overallSentiment
        : null;

    const notableMembersKo = Array.isArray(record.notableMembersKo)
        ? record.notableMembersKo.filter(
              (item): item is string => typeof item === 'string'
          )
        : [];

    const riskNoteKo =
        typeof record.riskNoteKo === 'string' ? record.riskNoteKo.trim() : '';

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
 * SEO pre-warm 스냅샷의 congress 탭 프로즈 렌더러 — Task 6, 다섯 번째 탭
 * 렌더러. `summaryKo`를 문단으로(`\n` 기준 분리), `overallSentiment`가
 * 있으면 리드 문구로, `notableMembersKo`를 목록으로, `riskNoteKo`를 참고
 * 사항 문단으로 렌더한다.
 *
 * 세 프로즈 소스 중 단 하나도 값이 없으면 아무것도 렌더하지 않아 — 빈 셸
 * 없이 — 호출부가 기존 placeholder로 폴백하도록 한다. UA 분기 없음 —
 * 사용자·크롤러에게 동일한 마크업(cloaking-safe).
 */
export function CongressSnapshotProse({
    content,
    symbol,
    displayName,
}: CongressSnapshotProseProps) {
    const narrowed = narrowCongressContent(content);
    if (narrowed === null) return null;

    const summaryParagraphs = narrowed.summaryKo
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);

    return (
        <SnapshotSummarySection displayName={displayName}>
            <div className="text-secondary-300 space-y-4 text-sm leading-6">
                {narrowed.overallSentiment !== null && (
                    <p className="text-secondary-200 font-medium">
                        {symbol} 의회 거래 동향:{' '}
                        {SENTIMENT_LABEL[narrowed.overallSentiment]}
                    </p>
                )}

                {summaryParagraphs.length > 0 && (
                    <div className="space-y-2">
                        {summaryParagraphs.map(line => (
                            <p key={line}>{line}</p>
                        ))}
                    </div>
                )}

                {narrowed.notableMembersKo.length > 0 && (
                    <div>
                        <h3 className="text-secondary-100 mb-1.5 text-sm font-semibold">
                            주목할 인물
                        </h3>
                        <ul
                            aria-label={`${symbol} 주목할 인물 목록`}
                            className="space-y-1"
                        >
                            {narrowed.notableMembersKo.map((member, i) => (
                                <li
                                    key={`member-${i}-${member}`}
                                    className="flex gap-2"
                                >
                                    <span
                                        aria-hidden="true"
                                        className="mt-0.5 shrink-0"
                                    >
                                        •
                                    </span>
                                    {member}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {narrowed.riskNoteKo.length > 0 && (
                    <div>
                        <h3 className="text-secondary-100 mb-1.5 text-sm font-semibold">
                            참고 사항
                        </h3>
                        <p>{narrowed.riskNoteKo}</p>
                    </div>
                )}
            </div>
        </SnapshotSummarySection>
    );
}
