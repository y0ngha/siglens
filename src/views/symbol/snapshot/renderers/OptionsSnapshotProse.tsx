import { useTranslations } from 'next-intl';
import type { OptionsSignalKind, OptionsTone } from '@y0ngha/siglens-core';
import { SnapshotSummarySection } from '../SnapshotSummarySection';
import { stripSnapshotMarkdown } from '../lib/stripSnapshotMarkdown';
import { createEnumGuard } from '../lib/createEnumGuard';
import type { MarketProfileId } from '@/shared/config/marketProfile';

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
}

const TONE_LABEL: Record<OptionsTone, string> = {
    bullish: '강세',
    bearish: '약세',
    cautious: '신중',
    neutral: '중립',
};

// See createEnumGuard's JSDoc for the Object.hasOwn / prototype-chain
// rationale (audit fix; PR #698 round-2 review FIX 3 extracted the shared
// implementation).
const isTone = createEnumGuard(TONE_LABEL);

const SIGNAL_KIND_LABEL: Record<OptionsSignalKind, string> = {
    bullish: '강세',
    bearish: '약세',
    volatility: '변동성',
    neutral: '중립',
};

const isSignalKind = createEnumGuard(SIGNAL_KIND_LABEL);

interface NarrowedPerExpiration {
    expirationDate: string;
    commentary: string;
    tone: OptionsTone | null;
}

function narrowPerExpiration(value: unknown): NarrowedPerExpiration | null {
    if (typeof value !== 'object' || value === null) return null;
    const record = value as Record<string, unknown>;
    const commentary =
        typeof record.commentary === 'string'
            ? stripSnapshotMarkdown(record.commentary).trim()
            : '';
    if (commentary.length === 0) return null;

    return {
        expirationDate:
            typeof record.expirationDate === 'string'
                ? record.expirationDate
                : '',
        commentary,
        tone: isTone(record.tone) ? record.tone : null,
    };
}

interface NarrowedSignal {
    kind: OptionsSignalKind | null;
    message: string;
}

function narrowSignal(value: unknown): NarrowedSignal | null {
    if (typeof value !== 'object' || value === null) return null;
    const record = value as Record<string, unknown>;
    const message =
        typeof record.message === 'string'
            ? stripSnapshotMarkdown(record.message).trim()
            : '';
    if (message.length === 0) return null;

    return {
        kind: isSignalKind(record.kind) ? record.kind : null,
        message,
    };
}

interface NarrowedOptionsContent {
    summary: string;
    perExpiration: NarrowedPerExpiration[];
    signals: NarrowedSignal[];
}

/**
 * `content`를 options 결과 모양으로 좁힌다.
 *
 * `summary`(심볼 요약), `perExpiration`(만기별 해설, 각 `commentary`를
 * 동반), `signals`(구조화 시그널, 각 `message`를 동반)가 프로즈 소스다. 이
 * 응답은 tier 마스킹을 거치지 않으므로 세 필드 전부 값이 채워질 수 있다.
 */
function narrowOptionsContent(content: unknown): NarrowedOptionsContent | null {
    if (typeof content !== 'object' || content === null) return null;

    const record = content as Record<string, unknown>;
    const summary =
        typeof record.summary === 'string'
            ? stripSnapshotMarkdown(record.summary).trim()
            : '';

    const perExpiration = Array.isArray(record.perExpiration)
        ? record.perExpiration.map(narrowPerExpiration).filter(e => e !== null)
        : [];

    const signals = Array.isArray(record.signals)
        ? record.signals.map(narrowSignal).filter(s => s !== null)
        : [];

    if (
        summary.length === 0 &&
        perExpiration.length === 0 &&
        signals.length === 0
    ) {
        return null;
    }

    return { summary, perExpiration, signals };
}

/**
 * `options/page.tsx`(→ `OptionsPageClient`)가 `<OptionsSnapshotProse>`를
 * 렌더할지 아니면 클라이언트 AI 위젯(`OptionsAiAnalysis`)을 렌더할지 판단하는
 * 예측기(audit fix FIX 2 — `OverallSnapshotProse.hasOverallProse` 패턴). 두
 * 소스가 같은 필드(summary/perExpiration/signals)를 같은 순서로 중복 렌더하던
 * 문제를 XOR 게이팅으로 해소한다.
 *
 * `narrowOptionsContent`를 그대로 재사용해 이 예측기와 컴포넌트가 서로 다른
 * 판단을 내릴 수 없게 한다(단일 진실 소스). `OptionsEmptyState`의
 * `snapshotSlot` 게이트(audit fix FIX 9)에서도 재사용된다.
 */
export function hasOptionsProse(content: unknown): boolean {
    return narrowOptionsContent(content) !== null;
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
}: OptionsSnapshotProseProps) {
    const t = useTranslations('views.symbol');
    const narrowed = narrowOptionsContent(content);
    if (narrowed === null) return null;

    return (
        <SnapshotSummarySection
            title={t('OptionsSnapshotProse.daaf55')}
            displayName={displayName}
            marketProfile={marketProfile}
            asOf={generatedAt}
        >
            <div className="space-y-4 text-sm leading-6 text-secondary-300">
                {narrowed.summary.length > 0 && (
                    <p className="font-medium text-secondary-200">
                        {narrowed.summary}
                    </p>
                )}

                {narrowed.perExpiration.length > 0 && (
                    <div>
                        <h3 className="mb-1.5 text-sm font-semibold text-secondary-200">
                            {t('OptionsSnapshotProse.935f5d')}
                        </h3>
                        <ul
                            role="list"
                            aria-label={`${symbol} 만기별 해석 목록`}
                            className="space-y-2"
                        >
                            {narrowed.perExpiration.map(item => (
                                <li key={item.expirationDate}>
                                    <span className="font-medium text-secondary-200">
                                        {item.expirationDate}
                                        {item.tone !== null &&
                                            ` (${TONE_LABEL[item.tone]})`}
                                    </span>
                                    <p>{item.commentary}</p>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {narrowed.signals.length > 0 && (
                    <div>
                        <h3 className="mb-1.5 text-sm font-semibold text-secondary-200">
                            {t('OptionsSnapshotProse.3a0721')}
                        </h3>
                        <ul
                            role="list"
                            aria-label={`${symbol} 옵션 시그널 목록`}
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
                                            `[${SIGNAL_KIND_LABEL[signal.kind]}] `}
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
