import { useTranslations } from 'next-intl';
import type { MarketProfileId } from '@/shared/config/marketProfile';
import { SnapshotSummarySection } from '../SnapshotSummarySection';
import { SnapshotBulletList } from '../SnapshotBulletList';
import { LIVE_ANALYSIS_CROSS_REF_KEY } from '../lib/liveAnalysisCrossRef';
import { ScenarioBullet, narrowOverallContent } from './overallContent';

interface OverallSnapshotProseProps {
    /**
     * `seo_analysis_snapshots.content` — 저장소에는 `unknown`으로 보관된다
     * (harvest.ts가 core `prewarmOverall`(→`submitOverallAnalysis`)의
     * `status==='cached'` 분기에서 얻은 `result.result: OverallAnalysisResponse`를
     * 그대로 저장, `src/app/api/cron/seo-prewarm/harvest.ts:91`). 여기서 다시
     * 방어적으로 좁힌다.
     *
     * `TechnicalSnapshotProse`와 달리 이 값은 core `filterAnalysisResult`의
     * 대상이 아니다 — core `pollOverallAnalysis`/`peekOverallAnalysisCache`
     * JSDoc이 명시하듯 `OverallAnalysisResponse`는 필드별 게이팅 detail이
     * 없는 synthesized headline/bullet narrative라 free tier로 pre-warm해도
     * 전 필드가 그대로 채워진다(타임프레임 게이트만 적용, 필드 마스킹 없음).
     */
    content: unknown;
    symbol: string;
    displayName: string;
    /**
     * overall 탭은 us-equity·kr-equity·crypto 전부 렌더한다 —
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
}

export { narrowOverallContent } from './overallContent';
export { hasOverallProse } from './overallContent';

/**
 * SEO pre-warm 스냅샷의 overall 탭 프로즈 렌더러 — `TechnicalSnapshotProse`가
 * 세운 패턴(spec 2026-07-24 Task 4)을 그대로 따르는 두 번째 탭 렌더러(Task 5).
 * `headlineKo`를 리드 문구로, `integratedConclusionKo`를 문단으로(`\n` 기준
 * 분리 — technical `summary`의 토픽 구분 관례와 동일하게 방어적으로 처리),
 * 강세/중립/약세 시나리오와 위험 요인을 각각 라벨 붙은 목록으로 렌더한다
 * (audit fix — 이전에는 neutral 시나리오와 riskFactorsKo를 드롭해 이 렌더러가
 * 대체하는 `OverallFactsSummary`보다 텍스트가 적었다).
 *
 * `technicalBulletsKo`/`fundamentalBulletsKo`/`newsBulletsKo`/
 * `optionsBulletsKo`/`financialsBulletsKo`도 각각 라벨 붙은 목록(기술적
 * 분석/펀더멘털/뉴스/옵션/재무제표)으로 렌더한다(audit fix FIX 2) — 배열이
 * 비어있으면 해당 섹션 헤딩 자체를 렌더하지 않는다(다른 목록 섹션들과
 * 동일한 "값 있을 때만" 계약).
 *
 * 모든 프로즈 소스(headline/conclusion/네 시나리오/위험 요인/4축 bullet
 * 다섯 배열)가 값이 없으면 아무것도 렌더하지 않아 — 빈 셸 없이 — 호출부가
 * 기존 placeholder로 폴백하도록 한다(위 `hasOverallProse`가 그 분기를
 * 담당). UA 분기 없음 — 사용자·크롤러에게 동일한 마크업(cloaking-safe).
 */
export function OverallSnapshotProse({
    content,
    symbol,
    displayName,
    marketProfile,
    generatedAt,
    plain,
}: OverallSnapshotProseProps) {
    const t = useTranslations('views.symbol');
    const tProse = useTranslations('views.symbol.snapshot.prose');
    const tMisc = useTranslations('shared.ui.misc');
    const narrowed = narrowOverallContent(content);
    if (narrowed === null) return null;

    /**
     * 시나리오 불릿 조립. 트리거·가격대 중 하나만 있으면 그것만 쓰고, 둘 다
     * 있으면 로케일 어순에 맞춘 템플릿으로 합친다.
     */
    const scenarioText = (bullets: ScenarioBullet[]): string[] =>
        bullets.map(({ trigger, priceRange }) => {
            if (trigger.length === 0)
                return tProse('expectedRange', { v0: priceRange });
            if (priceRange.length === 0) return trigger;
            return tProse('triggerWithRange', {
                v0: trigger,
                v1: priceRange,
            });
        });

    const conclusionParagraphs = narrowed.integratedConclusionKo
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);

    return (
        <SnapshotSummarySection
            title={t('OverallSnapshotProse.de4a87')}
            displayName={displayName}
            marketProfile={marketProfile}
            asOf={generatedAt}
            plain={plain}
        >
            <div className="space-y-4 text-sm leading-6 text-secondary-300">
                {/* 근거는 LIVE_ANALYSIS_CROSS_REF JSDoc 참고 — 두 탭이 동일 문구를 쓴다. */}
                <p className="text-xs text-secondary-400">
                    {tMisc(LIVE_ANALYSIS_CROSS_REF_KEY)}
                </p>
                {narrowed.headlineKo.length > 0 && (
                    <p className="font-medium text-secondary-200">
                        {narrowed.headlineKo}
                    </p>
                )}

                {conclusionParagraphs.length > 0 && (
                    <div className="space-y-2">
                        {conclusionParagraphs.map((line, i) => (
                            <p key={`line-${i}-${line}`}>{line}</p>
                        ))}
                    </div>
                )}

                <SnapshotBulletList
                    title={t('OverallSnapshotProse.da6fd3')}
                    symbol={symbol}
                    ariaSuffix={t('OverallSnapshotProse.da6fd3')}
                    items={narrowed.technicalBulletsKo}
                    keyPrefix="technical-bullet"
                />
                <SnapshotBulletList
                    title={t('OverallSnapshotProse.854e15')}
                    symbol={symbol}
                    ariaSuffix={t('OverallSnapshotProse.854e15')}
                    items={narrowed.fundamentalBulletsKo}
                    keyPrefix="fundamental-bullet"
                />
                <SnapshotBulletList
                    title={t('OverallSnapshotProse.3a465d')}
                    symbol={symbol}
                    ariaSuffix={t('OverallSnapshotProse.3a465d')}
                    items={narrowed.newsBulletsKo}
                    keyPrefix="news-bullet"
                />
                <SnapshotBulletList
                    title={t('OverallSnapshotProse.3c7dbc')}
                    symbol={symbol}
                    ariaSuffix={t('OverallSnapshotProse.3c7dbc')}
                    items={narrowed.optionsBulletsKo}
                    keyPrefix="options-bullet"
                />
                <SnapshotBulletList
                    title={t('OverallSnapshotProse.128c11')}
                    symbol={symbol}
                    ariaSuffix={t('OverallSnapshotProse.128c11')}
                    items={narrowed.financialsBulletsKo}
                    keyPrefix="financials-bullet"
                />

                <SnapshotBulletList
                    title={t('OverallSnapshotProse.b8f729')}
                    symbol={symbol}
                    ariaSuffix={t('OverallSnapshotProse.b8f729')}
                    items={scenarioText(narrowed.bullishBullets)}
                    keyPrefix="bullish"
                />
                <SnapshotBulletList
                    title={t('OverallSnapshotProse.ac2e2f')}
                    symbol={symbol}
                    ariaSuffix={t('OverallSnapshotProse.ac2e2f')}
                    items={scenarioText(narrowed.neutralBullets)}
                    keyPrefix="neutral"
                />
                <SnapshotBulletList
                    title={t('OverallSnapshotProse.288428')}
                    symbol={symbol}
                    ariaSuffix={t('OverallSnapshotProse.288428')}
                    items={scenarioText(narrowed.bearishBullets)}
                    keyPrefix="bearish"
                />
                <SnapshotBulletList
                    title={t('OverallSnapshotProse.af0480')}
                    symbol={symbol}
                    ariaSuffix={t('OverallSnapshotProse.af0480')}
                    items={narrowed.riskFactorsKo}
                    keyPrefix="risk"
                />
            </div>
        </SnapshotSummarySection>
    );
}
