import { useTranslations } from 'next-intl';
import { useAssetLabel } from '@/shared/i18n/assetLabel';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import { INTL_LOCALE } from '@/shared/i18n/locales';
import type { MarketBriefingResponse } from '@y0ngha/siglens-core';
import type { ClientDashboardScope } from '@/shared/config/dashboardScope';

interface BriefingCardProps {
    briefing: MarketBriefingResponse;
    generatedAt: string;
    /** 어느 시장의 브리핑인가. 근거 없는 항목을 걸러내는 데 쓴다. */
    scope: ClientDashboardScope;
}

/**
 * 브리핑이 지목한 섹터명 중 **이 시장에 실제로 존재하는 것만** 남긴다.
 *
 * 근본 수정은 core 0.48.0에서 끝났다 — 프롬프트가 섹터 행을 `한국어명 (티커)`로
 * 싣고 "목록 밖 이름을 쓰지 말라"고 못박는다. 옛 캐시는 문제가 아니다(캐시 키에
 * `MARKET_BRIEFING_PROMPT_TEMPLATE_VERSION`이 붙어 옛 엔트리는 도달 불가).
 * 그래도 **모델 출력이라 규칙 준수가 보증은 아니라서** 화면 앞단에서 한 번 더
 * 거른다 — 실제로 어긴 적이 있다(2026-08-19 `/market/kr` 실측: `XLK·XLV·XLY`).
 *
 * `leadingSectors`/`laggingSectors`는 core 0.48.0부터 **티커가 아니라 표시용
 * 한국어명**이다. 심볼로 비교하면 정상 출력이 전부 걸러진다.
 */
function knownSectors(
    names: readonly string[],
    scope: ClientDashboardScope
): { symbol: string; name: string }[] {
    // `sectorEtfs`만이 정확히 모델에 준 목록이다 — core `getMarketSummary`가
    // 프롬프트의 섹터 행을 이 배열로만 만든다. `signalSectors`를 합치면 미국의
    // 가상 테마(양자·우주 — 상장 ETF가 없어 브리핑 입력에 절대 없다)가 허용되어,
    // 이 가드가 막으려던 바로 그 "지어낸 이름"을 통과시킨다.
    //
    // **심볼을 돌려준다.** 이름을 그대로 내보내면 영어 페이지에서 `기술·금융`이
    // 바로 위 번역된 문장 옆에 붙는다. 화이트리스트를 통과했다는 건 이미 알려진
    // 섹터라는 뜻이므로, 표시 문자열은 심볼로 카탈로그에서 다시 찾는다.
    // (LLM 번역으로는 못 고친다 — 이 비교 자체가 `koreanName` 기준이라 번역하면
    //  모든 행이 걸러진다.)
    const bySectorName = new Map(
        scope.sectorEtfs.map(s => [s.koreanName, s.symbol])
    );
    return names
        .map(name => {
            const symbol = bySectorName.get(name);
            return symbol === undefined ? null : { symbol, name };
        })
        .filter(
            (entry): entry is { symbol: string; name: string } => entry !== null
        );
}

export function BriefingCard({
    briefing,
    generatedAt,
    scope,
}: BriefingCardProps) {
    const t = useTranslations('widgets.dashboard');
    const locale = useResolvedLocale();
    const assetLabel = useAssetLabel();
    const {
        summary,
        dominantThemes,
        sectorAnalysis,
        volatilityAnalysis,
        riskSentiment,
    } = briefing;

    const leadingSectors = knownSectors(sectorAnalysis.leadingSectors, scope);
    const laggingSectors = knownSectors(sectorAnalysis.laggingSectors, scope);
    // 이 시장에 변동성 지수가 없으면 숫자도 해설도 통째로 뺀다 — 해설 문장이
    // 그 숫자를 그대로 인용하므로 둘을 따로 살릴 수 없다.
    const volatility =
        scope.volatilityIndexSymbol === null ? null : volatilityAnalysis;

    return (
        <div className="flex flex-col gap-3 rounded-lg border border-secondary-700/50 p-4">
            {summary && (
                <p className="text-sm leading-relaxed text-secondary-300">
                    {summary}
                </p>
            )}

            {dominantThemes.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {dominantThemes.map(theme => (
                        <span
                            key={theme}
                            className="rounded bg-secondary-700/50 px-2 py-0.5 text-xs text-secondary-400"
                        >
                            {theme}
                        </span>
                    ))}
                </div>
            )}

            {/* 섹터명 줄이 전부 걸러져도 서술 문장은 남긴다 — 그 문장은 요약 데이터에서
                직접 나온 것이라(섹터 한국어명 + 실제 등락률) 근거가 있고, 카드에서
                가장 정보량이 많은 줄이다. 이 조건을 섹터명 유무와 묶으면 한국 페이지가
                제목·테마만 남은 빈 카드가 된다. */}
            {(leadingSectors.length > 0 ||
                laggingSectors.length > 0 ||
                sectorAnalysis.performanceDescription) && (
                <div className="flex flex-col gap-1">
                    {leadingSectors.length > 0 && (
                        <p className="text-xs">
                            <span className="mr-1 text-secondary-500">
                                {t('BriefingCard.e1760c')}
                            </span>
                            <span className="text-ui-success-text">
                                {leadingSectors
                                    .map(sector =>
                                        assetLabel(sector.symbol, sector.name)
                                    )
                                    .join('·')}
                            </span>
                        </p>
                    )}
                    {laggingSectors.length > 0 && (
                        <p className="text-xs">
                            <span className="mr-1 text-secondary-500">
                                {t('BriefingCard.7bd647')}
                            </span>
                            <span className="text-ui-danger-text">
                                {laggingSectors
                                    .map(sector =>
                                        assetLabel(sector.symbol, sector.name)
                                    )
                                    .join('·')}
                            </span>
                        </p>
                    )}
                    {sectorAnalysis.performanceDescription && (
                        <p className="text-xs text-secondary-500">
                            {sectorAnalysis.performanceDescription}
                        </p>
                    )}
                </div>
            )}

            {volatility !== null &&
                (volatility.vixLevel !== undefined ||
                    volatility.description) && (
                    <p className="text-xs text-secondary-500">
                        {volatility.vixLevel !== undefined && (
                            <span className="mr-1 font-mono text-secondary-400">
                                {scope.volatilityIndexSymbol}{' '}
                                {volatility.vixLevel.toFixed(2)}
                            </span>
                        )}
                        {volatility.description}
                    </p>
                )}

            {riskSentiment && (
                <p className="text-xs text-secondary-500">{riskSentiment}</p>
            )}

            {/* peek seed는 generatedAt이 빈 문자열이라 new Date('') = Invalid Date.
                BriefingCard는 action 응답으로 교체되기 전까지 타임스탬프 줄을
                숨겨 "Invalid Date 기준"이 노출되는 것을 막는다. */}
            {generatedAt && !Number.isNaN(new Date(generatedAt).getTime()) && (
                <p className="text-xs text-secondary-500">
                    {/* timeZone은 'Asia/Seoul'로 **고정**한다 — SSR(Node)과
                        CSR(브라우저) 사이 timezone mismatch로 인한 hydration
                        오류를 막기 위해서다. 반면 **로케일은 고정하면 안 된다**:
                        `'ko-KR'`로 박혀 있어서 `/en/market`이 번역된 문장 안에
                        `8월 20일 오전 02:39`를 찍었다. */}
                    {new Date(generatedAt).toLocaleString(INTL_LOCALE[locale], {
                        timeZone: 'Asia/Seoul',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                    })}{' '}
                    {t('BriefingCard.39b300')}
                </p>
            )}
        </div>
    );
}

export function BriefingLoadingCard() {
    const t = useTranslations('widgets.dashboard');
    return (
        <div
            role="status"
            aria-live="polite"
            className="rounded-lg border border-secondary-700/50 p-4"
        >
            <div className="flex items-center gap-2">
                <div className="h-2 w-2 animate-pulse rounded-full bg-secondary-700/50" />
                <p className="text-sm text-secondary-500">
                    {t('BriefingCard.38eff4')}
                </p>
            </div>
        </div>
    );
}

export function BriefingErrorCard() {
    const t = useTranslations('widgets.dashboard');
    return (
        <div
            role="alert"
            className="rounded-lg border border-secondary-700/50 p-4"
        >
            <p className="text-sm text-ui-danger-text">
                {t('BriefingCard.8b256d')}
            </p>
        </div>
    );
}
