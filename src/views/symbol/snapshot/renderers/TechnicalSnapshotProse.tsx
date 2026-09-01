import { useTranslations } from 'next-intl';
import type { MarketProfileId } from '@/shared/config/marketProfile';
import { useSkillLabel } from '@/shared/i18n/skillLabel';
import { SnapshotSummarySection } from '../SnapshotSummarySection';
import { LIVE_ANALYSIS_CROSS_REF_KEY } from '../lib/liveAnalysisCrossRef';
import { cn } from '@/shared/lib/cn';
import { HEADING_SUBSECTION } from '@/shared/lib/typographyStyles';
import { TREND_LABEL_KEY, narrowTechnicalContent } from './technicalContent';

interface TechnicalSnapshotProseProps {
    /**
     * `seo_analysis_snapshots.content` — 저장소에는 `unknown`으로 보관된다
     * (harvest.ts가 core `runAnalysis`의 `status==='cached'` 분기에서 얻은
     * `result.result: AnalysisResponse | FilteredAnalysisResponse`를 그대로
     * 저장, `src/app/api/cron/seo-prewarm/harvest.ts:91`). 여기서 다시
     * 방어적으로 좁힌다.
     */
    content: unknown;
    symbol: string;
    displayName: string;
    /**
     * chart(technical) 탭은 us-equity·kr-equity·crypto 전부 렌더한다 —
     * `SnapshotSummarySection` 셸의 캡션·타임존이 시장에 맞게 갈리도록 호출부가
     * 반드시 실제 값을 넘긴다.
     */
    marketProfile: MarketProfileId;
    /** 스냅샷 행의 `generatedAt`. 셸이 기준일 캡션과 "지난 AI 분석" 배지를 렌더하는 데 쓴다. */
    generatedAt?: Date;
    /**
     * 프리웜이 함께 구워 둔 평이화 산문. 셸이 쉽게보기 토글을 띄우는 데 쓴다.
     * 없으면 토글 없이 원문만 나온다.
     */
    plain?: string | null;
    /** 차트 탭에는 라이브 `AnalysisPanel`이 함께 있다 — 셸 JSDoc 참고. */
    duplicatesLiveWidget?: boolean;
}

export { narrowTechnicalContent } from './technicalContent';
export { hasTechnicalProse } from './technicalContent';

/**
 * SEO pre-warm 스냅샷의 technical 탭 프로즈 렌더러 — 7개 탭 렌더러가 따를
 * 첫 패턴(spec 2026-07-24 Task 4). `summary`(Korean 멀티토픽 요약, `\n`으로
 * 토픽 구분)를 문단으로, `trend`가 있으면 방향성 리드 문구를 렌더한다.
 *
 * `patternSummaries`/`strategyResults`를 각각 "차트 패턴"/"전략 시그널"
 * 라벨 붙은 목록으로 렌더한다(audit fix FIX 3) — 항목마다 패턴/전략 이름과
 * 방향성(있으면), Korean `summary`를 보여준다.
 *
 * `summary`/`patternSummaries`/`strategyResults` 세 프로즈 소스 모두 값이
 * 없으면 아무것도 렌더하지 않아 — 빈 셸 없이 — 호출부가 기존
 * placeholder(예: TechnicalFactsSummary)로 폴백하도록 한다. UA 분기 없음 —
 * 사용자·크롤러에게 동일한 마크업(cloaking-safe).
 */
export function TechnicalSnapshotProse({
    content,
    symbol,
    displayName,
    marketProfile,
    generatedAt,
    plain,
    duplicatesLiveWidget,
}: TechnicalSnapshotProseProps) {
    const t = useTranslations('views.symbol');
    const tMisc = useTranslations('shared.ui.misc');
    const tLabel = useTranslations('shared.enumLabel');
    const skillLabel = useSkillLabel();
    const narrowed = narrowTechnicalContent(content);
    if (narrowed === null) return null;

    const paragraphs = narrowed.summary
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);

    return (
        <SnapshotSummarySection
            title={t('TechnicalSnapshotProse.938737')}
            displayName={displayName}
            marketProfile={marketProfile}
            asOf={generatedAt}
            plain={plain}
            duplicatesLiveWidget={duplicatesLiveWidget}
        >
            <div className="space-y-4 text-sm leading-6 text-secondary-300">
                {/* 근거는 LIVE_ANALYSIS_CROSS_REF JSDoc 참고 — 두 탭이 동일 문구를 쓴다. */}
                <p className="text-xs text-secondary-400">
                    {tMisc(LIVE_ANALYSIS_CROSS_REF_KEY)}
                </p>
                <div className="space-y-2">
                    {narrowed.trend !== null && (
                        <p className="font-medium text-secondary-200">
                            {t('TechnicalSnapshotProse.4195b7', {
                                v0: symbol,
                                v1: tLabel(TREND_LABEL_KEY[narrowed.trend]),
                            })}
                        </p>
                    )}
                    {paragraphs.map((line, i) => (
                        <p key={`line-${i}-${line}`}>{line}</p>
                    ))}
                </div>

                {narrowed.patternSummaries.length > 0 && (
                    <div>
                        <h3 className={cn('mb-1.5', HEADING_SUBSECTION)}>
                            {t('TechnicalSnapshotProse.bdeea2')}
                        </h3>
                        <ul
                            role="list"
                            aria-label={t(
                                'TechnicalSnapshotProse.patternListLabel',
                                {
                                    v0: symbol,
                                }
                            )}
                            className="space-y-2"
                        >
                            {narrowed.patternSummaries.map(p => (
                                <li key={`${p.name}-${p.summary.slice(0, 32)}`}>
                                    <span className="font-medium text-secondary-200">
                                        {skillLabel(p.name)}
                                        {p.trend !== null &&
                                            ` (${tLabel(TREND_LABEL_KEY[p.trend])})`}
                                    </span>
                                    <p>{p.summary}</p>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {narrowed.strategyResults.length > 0 && (
                    <div>
                        <h3 className={cn('mb-1.5', HEADING_SUBSECTION)}>
                            {t('TechnicalSnapshotProse.3d874f')}
                        </h3>
                        <ul
                            role="list"
                            aria-label={t(
                                'TechnicalSnapshotProse.strategyListLabel',
                                {
                                    v0: symbol,
                                }
                            )}
                            className="space-y-2"
                        >
                            {narrowed.strategyResults.map(s => (
                                <li key={`${s.name}-${s.summary.slice(0, 32)}`}>
                                    <span className="font-medium text-secondary-200">
                                        {skillLabel(s.name)}
                                        {s.trend !== null &&
                                            ` (${tLabel(TREND_LABEL_KEY[s.trend])})`}
                                    </span>
                                    <p>{s.summary}</p>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </SnapshotSummarySection>
    );
}
