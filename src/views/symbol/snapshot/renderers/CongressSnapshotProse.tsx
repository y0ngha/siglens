import { useTranslations } from 'next-intl';
import type { CongressSentiment } from '@y0ngha/siglens-core';
import { SnapshotSummarySection } from '../SnapshotSummarySection';
import { SnapshotBulletList } from '../SnapshotBulletList';
import { stripSnapshotMarkdown } from '../lib/stripSnapshotMarkdown';
import { createEnumGuard } from '../lib/createEnumGuard';
import { narrowStringArray } from '../lib/narrowStringArray';
import type { MarketProfileId } from '@/shared/config/marketProfile';

interface CongressSnapshotProseProps {
    /**
     * `seo_analysis_snapshots.content` — 저장소에는 `unknown`으로 보관된다
     * (harvest.ts가 core `prewarmCongress`(→`submitCongressTrend`)의
     * `status==='cached'` 분기에서 얻은 `result.result: CongressTrendResponse`를
     * 그대로 저장, `src/entities/analysis/api.ts`). 여기서 다시
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
    /**
     * congress 탭은 us-equity 전용이다(`KR_EQUITY_DESCRIPTOR`/`CRYPTO_DESCRIPTOR`
     * 둘 다 `tabs`에 `'congress'`가 없다). 그래도 `SnapshotSummarySection` 셸의
     * 캡션 계약은 이 값을 요구하므로 호출부가 `'us-equity'`를 그대로 넘긴다.
     */
    marketProfile: MarketProfileId;
    /** 스냅샷 행의 `generatedAt`. 셸이 기준일 캡션과 "지난 AI 분석" 배지를 렌더하는 데 쓴다. */
    generatedAt?: Date;
}

/** CongressSentiment → `shared.enumLabel` 카탈로그 키. 값 자체는 더 이상 한글이 아니다 — 렌더 시점에 `tLabel`로 조회한다. */
const SENTIMENT_LABEL_KEY: Record<CongressSentiment, string> = {
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
function narrowCongressContent(
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
    marketProfile,
    generatedAt,
}: CongressSnapshotProseProps) {
    const t = useTranslations('views.symbol');
    const tLabel = useTranslations('shared.enumLabel');
    const narrowed = narrowCongressContent(content);
    if (narrowed === null) return null;

    const summaryParagraphs = narrowed.summaryKo
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);

    return (
        <SnapshotSummarySection
            title={t('CongressSnapshotProse.f7e3fb')}
            displayName={displayName}
            marketProfile={marketProfile}
            asOf={generatedAt}
        >
            <div className="space-y-4 text-sm leading-6 text-secondary-300">
                {narrowed.overallSentiment !== null && (
                    <p className="font-medium text-secondary-200">
                        {t('CongressSnapshotProse.739702', {
                            v0: symbol,
                            v1: tLabel(
                                SENTIMENT_LABEL_KEY[narrowed.overallSentiment]
                            ),
                        })}
                    </p>
                )}

                {summaryParagraphs.length > 0 && (
                    <div className="space-y-2">
                        {summaryParagraphs.map((line, i) => (
                            <p key={`line-${i}-${line}`}>{line}</p>
                        ))}
                    </div>
                )}

                <SnapshotBulletList
                    title={t('CongressSnapshotProse.9a15c9')}
                    symbol={symbol}
                    ariaSuffix={t('CongressSnapshotProse.9a15c9')}
                    items={narrowed.notableMembersKo}
                    keyPrefix="member"
                />

                {narrowed.riskNoteKo.length > 0 && (
                    <div>
                        <h3 className="mb-1.5 text-sm font-semibold text-secondary-200">
                            {t('CongressSnapshotProse.b2e4d7')}
                        </h3>
                        <p>{narrowed.riskNoteKo}</p>
                    </div>
                )}
            </div>
        </SnapshotSummarySection>
    );
}
