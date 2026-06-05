import type { MarketBriefingResponse } from '@y0ngha/siglens-core';

interface BriefingCardProps {
    briefing: MarketBriefingResponse;
    generatedAt: string;
}

export function BriefingCard({ briefing, generatedAt }: BriefingCardProps) {
    const {
        summary,
        dominantThemes,
        sectorAnalysis,
        volatilityAnalysis,
        riskSentiment,
    } = briefing;

    return (
        <div className="border-secondary-700/50 flex flex-col gap-3 rounded-lg border p-4">
            {summary && (
                <p className="text-secondary-300 text-sm leading-relaxed">
                    {summary}
                </p>
            )}

            {dominantThemes.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {dominantThemes.map(theme => (
                        <span
                            key={theme}
                            className="bg-secondary-700/50 text-secondary-400 rounded px-2 py-0.5 text-xs"
                        >
                            {theme}
                        </span>
                    ))}
                </div>
            )}

            {(sectorAnalysis.leadingSectors.length > 0 ||
                sectorAnalysis.laggingSectors.length > 0) && (
                <div className="flex flex-col gap-1">
                    {sectorAnalysis.leadingSectors.length > 0 && (
                        <p className="text-xs">
                            <span className="text-secondary-500 mr-1">
                                상승 섹터
                            </span>
                            <span className="text-chart-bullish font-mono">
                                {sectorAnalysis.leadingSectors.join('·')}
                            </span>
                        </p>
                    )}
                    {sectorAnalysis.laggingSectors.length > 0 && (
                        <p className="text-xs">
                            <span className="text-secondary-500 mr-1">
                                하락 섹터
                            </span>
                            <span className="text-chart-bearish font-mono">
                                {sectorAnalysis.laggingSectors.join('·')}
                            </span>
                        </p>
                    )}
                    {sectorAnalysis.performanceDescription && (
                        <p className="text-secondary-500 text-xs">
                            {sectorAnalysis.performanceDescription}
                        </p>
                    )}
                </div>
            )}

            {(volatilityAnalysis.vixLevel !== undefined ||
                volatilityAnalysis.description) && (
                <p className="text-secondary-500 text-xs">
                    {volatilityAnalysis.vixLevel !== undefined && (
                        <span className="text-secondary-400 mr-1 font-mono">
                            VIX {volatilityAnalysis.vixLevel.toFixed(2)}
                        </span>
                    )}
                    {volatilityAnalysis.description}
                </p>
            )}

            {riskSentiment && (
                <p className="text-secondary-500 text-xs">{riskSentiment}</p>
            )}

            {/* peek seed는 generatedAt이 빈 문자열이라 new Date('') = Invalid Date.
                BriefingCard는 action 응답으로 교체되기 전까지 타임스탬프 줄을
                숨겨 "Invalid Date 기준"이 노출되는 것을 막는다. */}
            {generatedAt && !Number.isNaN(new Date(generatedAt).getTime()) && (
                <p className="text-secondary-600 text-xs">
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
            className="border-secondary-700/50 rounded-lg border p-4"
        >
            <div className="flex items-center gap-2">
                <div className="bg-secondary-700/50 h-2 w-2 animate-pulse rounded-full" />
                <p className="text-secondary-500 text-sm">AI 브리핑 생성 중…</p>
            </div>
        </div>
    );
}

export function BriefingErrorCard() {
    return (
        <div
            role="alert"
            className="border-secondary-700/50 rounded-lg border p-4"
        >
            <p className="text-chart-bearish text-sm">
                브리핑을 불러오지 못했어요.
            </p>
        </div>
    );
}
