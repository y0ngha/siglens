import { useTranslations } from 'next-intl';
import type { MarketProfileId } from '@/shared/config/marketProfile';
import { SnapshotSummarySection } from '../SnapshotSummarySection';
import { SnapshotBulletList } from '../SnapshotBulletList';
import { cn } from '@/shared/lib/cn';
import { HEADING_SUBSECTION } from '@/shared/lib/typographyStyles';
import { SENTIMENT_LABEL_KEY, narrowCongressContent } from './congressContent';

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
    /**
     * 프리웜이 함께 구워 둔 평이화 산문. 셸이 쉽게보기 토글을 띄우는 데 쓴다.
     * 없으면 토글 없이 원문만 나온다.
     */
    plain?: string | null;
}

export { narrowCongressContent } from './congressContent';
export { hasCongressProse } from './congressContent';

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
    plain,
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
            plain={plain}
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
                        <h3 className={cn('mb-1.5', HEADING_SUBSECTION)}>
                            {t('CongressSnapshotProse.b2e4d7')}
                        </h3>
                        <p>{narrowed.riskNoteKo}</p>
                    </div>
                )}
            </div>
        </SnapshotSummarySection>
    );
}
