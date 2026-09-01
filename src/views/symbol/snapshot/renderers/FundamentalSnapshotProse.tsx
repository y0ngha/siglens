import { useTranslations } from 'next-intl';
import type { MarketProfileId } from '@/shared/config/marketProfile';
import { SnapshotSummarySection } from '../SnapshotSummarySection';
import { SnapshotBulletList } from '../SnapshotBulletList';
import { cn } from '@/shared/lib/cn';
import { HEADING_SUBSECTION } from '@/shared/lib/typographyStyles';
import {
    CATEGORY_LABEL_KEY,
    SENTIMENT_LABEL_KEY,
    narrowFundamentalContent,
} from './fundamentalContent';

interface FundamentalSnapshotProseProps {
    /**
     * `seo_analysis_snapshots.content` — 저장소에는 `unknown`으로 보관된다
     * (harvest.ts가 core `prewarmFundamental`(→`submitFundamentalAnalysis`)의
     * `status==='cached'` 분기에서 얻은 `result.result: FundamentalAnalysisResponse`를
     * 그대로 저장, `src/entities/analysis/api.ts`). 여기서 다시
     * 방어적으로 좁힌다.
     *
     * `OverallSnapshotProse`와 같은 이유로 이 값은 core `filterAnalysisResult`
     * (technical 전용 info-depth 필드 마스킹)의 대상이 아니다 — fundamental
     * submit 경로(`submitFundamentalAnalysis.js`)는 `tier`를 BYOK 게이트·
     * usage 한도·스킬 샘플링·캐시 키에만 사용하고, 응답 필드 자체를 tier로
     * 마스킹하는 코드 경로가 없다. free tier로 pre-warm해도 전 필드가 그대로
     * 채워진다.
     */
    content: unknown;
    symbol: string;
    displayName: string;
    /**
     * fundamental 탭은 us-equity·kr-equity 둘 다 렌더한다 — `SnapshotSummarySection`
     * 셸의 캡션·타임존이 시장에 맞게 갈리도록 호출부가 반드시 실제 값을 넘긴다.
     */
    marketProfile: MarketProfileId;
    /** 스냅샷 행의 `generatedAt`. 셸이 기준일 캡션과 "지난 AI 분석" 배지를 렌더하는 데 쓴다. */
    generatedAt?: Date;
    /**
     * 프리웜이 함께 구워 둔 평이화 산문. 셸이 쉽게보기 토글을 띄우는 데 쓴다.
     * 없으면 토글 없이 원문만 나온다.
     */
    plain?: string | null;
}

export { narrowFundamentalContent } from './fundamentalContent';
export { hasFundamentalProse } from './fundamentalContent';

/**
 * SEO pre-warm 스냅샷의 fundamental 탭 프로즈 렌더러 —
 * `TechnicalSnapshotProse`/`OverallSnapshotProse`가 세운 패턴(spec
 * 2026-07-24 Task 4~5)을 따르는 세 번째 탭 렌더러(Task 6). `overallConclusionKo`를
 * 문단으로(`\n` 기준 분리), `overallSentiment`가 있으면 리드 문구로,
 * `categoryAssessments`를 카테고리 라벨 붙은 목록으로, `riskFactorsKo`를
 * 위험 요인 목록으로 렌더한다.
 *
 * 네 프로즈 소스 중 단 하나도 값이 없으면 아무것도 렌더하지 않아 — 빈 셸
 * 없이 — 호출부가 기존 placeholder로 폴백하도록 한다. UA 분기 없음 —
 * 사용자·크롤러에게 동일한 마크업(cloaking-safe).
 */
export function FundamentalSnapshotProse({
    content,
    symbol,
    displayName,
    marketProfile,
    generatedAt,
    plain,
}: FundamentalSnapshotProseProps) {
    const t = useTranslations('views.symbol');
    const tLabel = useTranslations('shared.enumLabel');
    const narrowed = narrowFundamentalContent(content);
    if (narrowed === null) return null;

    const conclusionParagraphs = narrowed.overallConclusionKo
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);

    return (
        <SnapshotSummarySection
            title={t('FundamentalSnapshotProse.05a94d')}
            displayName={displayName}
            marketProfile={marketProfile}
            asOf={generatedAt}
            plain={plain}
        >
            <div className="space-y-4 text-sm leading-6 text-secondary-300">
                {narrowed.overallSentiment !== null && (
                    <p className="font-medium text-secondary-200">
                        {t('FundamentalSnapshotProse.8a9040', {
                            v0: symbol,
                            v1: tLabel(
                                SENTIMENT_LABEL_KEY[narrowed.overallSentiment]
                            ),
                        })}
                    </p>
                )}

                {conclusionParagraphs.length > 0 && (
                    <div className="space-y-2">
                        {conclusionParagraphs.map((line, i) => (
                            <p key={`line-${i}-${line}`}>{line}</p>
                        ))}
                    </div>
                )}

                {narrowed.categoryAssessments.length > 0 && (
                    <div>
                        <h3 className={cn('mb-1.5', HEADING_SUBSECTION)}>
                            {t('FundamentalSnapshotProse.74f3b1')}
                        </h3>
                        <ul
                            role="list"
                            aria-label={t(
                                'FundamentalSnapshotProse.categoryListLabel',
                                { v0: symbol }
                            )}
                            className="space-y-2"
                        >
                            {narrowed.categoryAssessments.map(a => (
                                <li key={a.category}>
                                    <span className="font-medium text-secondary-200">
                                        {tLabel(CATEGORY_LABEL_KEY[a.category])}
                                        {a.sentiment !== null &&
                                            ` (${tLabel(SENTIMENT_LABEL_KEY[a.sentiment])})`}
                                    </span>
                                    {a.rationaleKo.length > 0 && (
                                        <p>{a.rationaleKo}</p>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                <SnapshotBulletList
                    title={t('FundamentalSnapshotProse.af0480')}
                    symbol={symbol}
                    ariaSuffix={t('FundamentalSnapshotProse.af0480')}
                    items={narrowed.riskFactorsKo}
                    keyPrefix="risk"
                />
            </div>
        </SnapshotSummarySection>
    );
}
