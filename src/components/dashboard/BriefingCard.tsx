import type { MarketBriefingResponse } from '@/domain/types';

interface BriefingCardProps {
    briefing: MarketBriefingResponse | null;
    generatedAt: string | null;
    isLoading: boolean;
    error: string | null;
}

export function BriefingCard({
    briefing,
    generatedAt,
    isLoading,
    error,
}: BriefingCardProps) {
    if (isLoading) {
        return (
            <div className="border-secondary-700/50 rounded-lg border p-4">
                <div className="flex items-center gap-2">
                    <div className="bg-secondary-700/50 h-2 w-2 animate-pulse rounded-full" />
                    <p className="text-secondary-500 text-sm">
                        AI 브리핑 생성 중...
                    </p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="border-secondary-700/50 rounded-lg border p-4">
                <p className="text-chart-bearish text-sm">
                    브리핑을 불러오지 못했습니다.
                </p>
            </div>
        );
    }

    if (!briefing) return null;

    const {
        summary,
        dominantThemes,
        sectorAnalysis,
        volatilityAnalysis,
        riskSentiment,
    } = briefing;

    return (
        <div className="border-secondary-700/50 flex flex-col gap-3 rounded-lg border p-4">
            {/* 요약 */}
            {summary && (
                <p className="text-secondary-300 text-sm leading-relaxed">
                    {summary}
                </p>
            )}

            {/* 주요 테마 */}
            {dominantThemes && dominantThemes.length > 0 && (
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

            {/* 섹터 분석 */}
            {((sectorAnalysis &&
                sectorAnalysis.leadingSectors &&
                sectorAnalysis.leadingSectors.length > 0) ||
                (sectorAnalysis.laggingSectors &&
                    sectorAnalysis.laggingSectors.length > 0)) && (
                <div className="flex flex-col gap-1">
                    {sectorAnalysis.leadingSectors.length > 0 && (
                        <p className="text-xs">
                            <span className="text-secondary-500 mr-1">
                                상승
                            </span>
                            <span className="text-chart-bullish font-mono">
                                {sectorAnalysis.leadingSectors.join(' · ')}
                            </span>
                        </p>
                    )}
                    {sectorAnalysis.laggingSectors.length > 0 && (
                        <p className="text-xs">
                            <span className="text-secondary-500 mr-1">
                                하락
                            </span>
                            <span className="text-chart-bearish font-mono">
                                {sectorAnalysis.laggingSectors.join(' · ')}
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

            {/* 변동성 */}
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

            {/* 리스크 심리 */}
            {riskSentiment && (
                <p className="text-secondary-500 text-xs">{riskSentiment}</p>
            )}

            {/* 생성 시각 */}
            {generatedAt && (
                <p className="text-secondary-600 text-xs">
                    {new Date(generatedAt).toLocaleString('ko-KR', {
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                    })}{' '}
                    기준 분석
                </p>
            )}
        </div>
    );
}
