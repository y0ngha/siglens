import { useTranslations } from 'next-intl';
import { SnapshotSummarySection } from '../SnapshotSummarySection';
import { cn } from '@/shared/lib/cn';
import { HEADING_SUBSECTION } from '@/shared/lib/typographyStyles';
import type { MarketProfileId } from '@/shared/config/marketProfile';
import {
    narrowOptionsContent,
    SIGNAL_KIND_LABEL_KEY,
    TONE_LABEL_KEY,
} from './optionsContent';

/*
 * 판별 함수는 컴포넌트 없는 `optionsContent.ts`에 있다. 재-export로 기존
 * 소비자(`hasProseForTab`)의 import 경로를 유지하되, 그쪽은 이제 컴포넌트를
 * 거치지 않고 `.ts`를 직접 가져간다 — 서버 전용 메타데이터 헬퍼가 React
 * 트리를 끌어오던 체인을 끊기 위한 분리다.
 */
export { hasOptionsProse } from './optionsContent';

interface OptionsSnapshotProseProps {
    /**
     * `seo_analysis_snapshots.content` — 저장소에는 `unknown`으로 보관된다
     * (harvest.ts가 `prewarmOptions`(→core `submitOptionsAnalysis`)의
     * `status==='cached'` 분기에서 얻은 `result.result: OptionsAnalysisResponse`를
     * 그대로 저장, `src/entities/options-chain/api.ts`).
     * 여기서 다시 방어적으로 좁힌다.
     *
     * `FundamentalSnapshotProse`와 같은 이유로 이 값은 core
     * `filterAnalysisResult`(technical 전용 info-depth 필드 마스킹)의 대상이
     * 아니다 — options submit 경로(`submitOptionsAnalysis.js`)는 `tier`를
     * BYOK 게이트·usage 한도에만 사용하고, 응답 필드 자체를 tier로 마스킹하는
     * 코드 경로가 없다. free tier로 pre-warm해도 전 필드가 그대로 채워진다.
     *
     * `analyzedAt`은 프로즈가 아닌 타임스탬프라 렌더 대상이 아니다 — ISR
     * 재검증 시점마다 값이 달라지는 필드를 렌더에 쓰지 않는다는
     * `SnapshotSummarySection`의 결정적 출력 원칙과 동일하게 이 렌더러도
     * 이 필드를 읽지 않는다.
     */
    content: unknown;
    symbol: string;
    displayName: string;
    /**
     * options 탭은 us-equity 전용이다(`KR_EQUITY_DESCRIPTOR`/`CRYPTO_DESCRIPTOR`
     * 둘 다 `tabs`에 `'options'`가 없다). 그래도 `SnapshotSummarySection` 셸의
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

/**
 * SEO pre-warm 스냅샷의 options 탭 프로즈 렌더러 — Task 6, 여섯 번째 탭
 * 렌더러. `summary`를 리드 문단으로, `perExpiration`을 만기 날짜+톤 라벨
 * 붙은 해설 목록으로, `signals`를 시그널 종류 라벨 붙은 목록으로 렌더한다.
 *
 * `OptionsAnalysisResponse`는 다른 네 탭과 달리 심볼 단위 `overallSentiment`가
 * 없다(만기별 `tone`·시그널별 `kind`만 존재) — 이 렌더러가 심볼 단위 리드
 * 문구를 렌더하지 않는 이유다.
 *
 * 세 프로즈 소스 중 단 하나도 값이 없으면 아무것도 렌더하지 않아 — 빈 셸
 * 없이 — 호출부가 기존 placeholder로 폴백하도록 한다. UA 분기 없음 —
 * 사용자·크롤러에게 동일한 마크업(cloaking-safe).
 */
export function OptionsSnapshotProse({
    content,
    symbol,
    displayName,
    marketProfile,
    generatedAt,
    plain,
}: OptionsSnapshotProseProps) {
    const t = useTranslations('views.symbol');
    const tLabel = useTranslations('shared.enumLabel');
    const narrowed = narrowOptionsContent(content);
    if (narrowed === null) return null;

    return (
        <SnapshotSummarySection
            title={t('OptionsSnapshotProse.daaf55')}
            displayName={displayName}
            marketProfile={marketProfile}
            asOf={generatedAt}
            plain={plain}
        >
            <div className="space-y-4 text-sm leading-6 text-secondary-300">
                {narrowed.summary.length > 0 && (
                    <p className="font-medium text-secondary-200">
                        {narrowed.summary}
                    </p>
                )}

                {narrowed.perExpiration.length > 0 && (
                    <div>
                        <h3 className={cn('mb-1.5', HEADING_SUBSECTION)}>
                            {t('OptionsSnapshotProse.935f5d')}
                        </h3>
                        <ul
                            role="list"
                            aria-label={t(
                                'OptionsSnapshotProse.expiryListLabel',
                                { v0: symbol }
                            )}
                            className="space-y-2"
                        >
                            {narrowed.perExpiration.map(item => (
                                <li key={item.expirationDate}>
                                    <span className="font-medium text-secondary-200">
                                        {item.expirationDate}
                                        {item.tone !== null &&
                                            ` (${tLabel(TONE_LABEL_KEY[item.tone])})`}
                                    </span>
                                    <p>{item.commentary}</p>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {narrowed.signals.length > 0 && (
                    <div>
                        <h3 className={cn('mb-1.5', HEADING_SUBSECTION)}>
                            {t('OptionsSnapshotProse.3a0721')}
                        </h3>
                        <ul
                            role="list"
                            aria-label={t(
                                'OptionsSnapshotProse.signalListLabel',
                                { v0: symbol }
                            )}
                            className="space-y-1"
                        >
                            {narrowed.signals.map(signal => (
                                <li
                                    key={`${signal.kind ?? 'unknown'}-${signal.message}`}
                                    className="flex gap-2"
                                >
                                    <span
                                        aria-hidden="true"
                                        className="mt-0.5 shrink-0"
                                    >
                                        •
                                    </span>
                                    <span className="min-w-0 break-words">
                                        {signal.kind !== null &&
                                            `[${tLabel(SIGNAL_KIND_LABEL_KEY[signal.kind])}] `}
                                        {signal.message}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </SnapshotSummarySection>
    );
}
