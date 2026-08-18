import type { MarketBriefingResponse } from '@y0ngha/siglens-core';
import type { ClientDashboardScope } from '@/shared/config/dashboardScope';

interface BriefingCardProps {
    briefing: MarketBriefingResponse;
    generatedAt: string;
    /** 어느 시장의 브리핑인가. 근거 없는 항목을 걸러내는 데 쓴다. */
    scope: ClientDashboardScope;
}

/**
 * 브리핑이 지목한 섹터 티커 중 **이 시장에 실제로 존재하는 것만** 남긴다.
 *
 * core `marketBriefingPrompt`는 섹터 필드를 `"섹터 ETF 티커 (예: 'XLK')"`로 설명한다.
 * 예시가 미국 티커라서, 한국 요약을 넣어도 모델이 `XLK·XLV·XLY`를 돌려주는 일이
 * 생긴다(2026-08-19 `/market/kr` 실측). 티커는 그럴듯해 보이고 옆의 서술 문장은
 * 한국 수치라, 화면만 보고는 틀렸다는 걸 알아채기 어렵다.
 *
 * 근본 수정은 core 프롬프트 쪽이다(`docs/architecture/SCOPE.md` — 프롬프트는 core 소유).
 * 여기서는 **화면에 근거 없는 티커를 올리지 않는 것**만 책임진다.
 */
function knownSectors(
    tickers: readonly string[],
    scope: ClientDashboardScope
): string[] {
    const known = new Set([
        ...scope.sectorEtfs.map(s => s.symbol),
        ...scope.signalSectors.map(s => s.symbol),
    ]);
    return tickers.filter(t => known.has(t));
}

export function BriefingCard({
    briefing,
    generatedAt,
    scope,
}: BriefingCardProps) {
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
        scope.volatilityIndexLabel === null ? null : volatilityAnalysis;

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

            {/* 티커 줄이 전부 걸러져도 서술 문장은 남긴다 — 그 문장은 요약 데이터에서
                직접 나온 것이라(섹터 한국어명 + 실제 등락률) 근거가 있고, 카드에서
                가장 정보량이 많은 줄이다. 이 조건을 티커 유무와 묶으면 한국 페이지가
                제목·테마만 남은 빈 카드가 된다. */}
            {(leadingSectors.length > 0 ||
                laggingSectors.length > 0 ||
                sectorAnalysis.performanceDescription) && (
                <div className="flex flex-col gap-1">
                    {leadingSectors.length > 0 && (
                        <p className="text-xs">
                            <span className="mr-1 text-secondary-500">
                                상승 섹터
                            </span>
                            <span className="font-mono text-chart-bullish">
                                {leadingSectors.join('·')}
                            </span>
                        </p>
                    )}
                    {laggingSectors.length > 0 && (
                        <p className="text-xs">
                            <span className="mr-1 text-secondary-500">
                                하락 섹터
                            </span>
                            <span className="font-mono text-chart-bearish">
                                {laggingSectors.join('·')}
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
                                {scope.volatilityIndexLabel}{' '}
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
                <p className="text-xs text-secondary-600">
                    {/* timeZone을 'Asia/Seoul'로 고정해 SSR(Node 서버)와 CSR(브라우저)
                        사이 timezone mismatch로 인한 hydration 오류를 막는다. 본
                        프로덕트는 한국어 사용자 대상이라 KST 표기가 의미에도 부합. */}
                    {new Date(generatedAt).toLocaleString('ko-KR', {
                        timeZone: 'Asia/Seoul',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                    })}{' '}
                    기준
                </p>
            )}
        </div>
    );
}

export function BriefingLoadingCard() {
    return (
        <div
            role="status"
            aria-live="polite"
            className="rounded-lg border border-secondary-700/50 p-4"
        >
            <div className="flex items-center gap-2">
                <div className="h-2 w-2 animate-pulse rounded-full bg-secondary-700/50" />
                <p className="text-sm text-secondary-500">AI 브리핑 생성 중…</p>
            </div>
        </div>
    );
}

export function BriefingErrorCard() {
    return (
        <div
            role="alert"
            className="rounded-lg border border-secondary-700/50 p-4"
        >
            <p className="text-sm text-chart-bearish">
                브리핑을 불러오지 못했어요.
            </p>
        </div>
    );
}
