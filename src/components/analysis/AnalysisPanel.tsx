'use client';

import type {
    AnalysisResponse,
    RiskLevel,
    Signal,
    SignalStrength,
    SignalType,
    Trend,
} from '@/domain/types';
import { cn } from '@/lib/cn';

const TREND_COLOR: Record<Trend, string> = {
    bullish: 'text-teal-400',
    bearish: 'text-red-400',
    neutral: 'text-secondary-400',
};

const TREND_LABEL: Record<Trend, string> = {
    bullish: '상승',
    bearish: '하락',
    neutral: '중립',
};

const RISK_LEVEL_COLOR: Record<RiskLevel, string> = {
    low: 'text-teal-400',
    medium: 'text-yellow-400',
    high: 'text-red-400',
};

const RISK_LEVEL_LABEL: Record<RiskLevel, string> = {
    low: '낮음',
    medium: '보통',
    high: '높음',
};

const SIGNAL_STRENGTH_COLOR: Record<SignalStrength, string> = {
    strong: 'text-teal-400',
    moderate: 'text-yellow-400',
    weak: 'text-secondary-400',
};

const SIGNAL_STRENGTH_LABEL: Record<SignalStrength, string> = {
    strong: '강',
    moderate: '중',
    weak: '약',
};

const SIGNAL_TYPE_LABEL: Record<SignalType, string> = {
    rsi_overbought: 'RSI 과매수',
    rsi_oversold: 'RSI 과매도',
    macd_golden_cross: 'MACD 골든 크로스',
    macd_dead_cross: 'MACD 데드 크로스',
    bollinger_upper_breakout: '볼린저 상단 돌파',
    bollinger_lower_breakout: '볼린저 하단 이탈',
    bollinger_squeeze: '볼린저 스퀴즈',
    dmi_bullish_trend: 'DMI 상승 추세',
    dmi_bearish_trend: 'DMI 하락 추세',
    pattern: '패턴',
    skill: '스킬',
};

interface SignalItemProps {
    signal: Signal;
}

function SignalItem({ signal }: SignalItemProps) {
    return (
        <div className="bg-secondary-700/40 flex items-start gap-2 rounded px-3 py-2">
            <span
                className={cn(
                    'mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold',
                    SIGNAL_STRENGTH_COLOR[signal.strength]
                )}
            >
                {SIGNAL_STRENGTH_LABEL[signal.strength]}
            </span>
            <div className="min-w-0 flex-1">
                <span className="text-secondary-300 block text-xs font-medium">
                    {SIGNAL_TYPE_LABEL[signal.type]}
                </span>
                <span className="text-secondary-400 block text-xs">
                    {signal.description}
                </span>
            </div>
        </div>
    );
}

interface AnalysisPanelProps {
    analysis: AnalysisResponse;
    onReanalyze: () => void;
}

export function AnalysisPanel({ analysis, onReanalyze }: AnalysisPanelProps) {
    const allSignals = [
        ...analysis.signals,
        ...analysis.skillSignals.flatMap(s => s.signals),
    ];

    return (
        <div className="bg-secondary-800 flex flex-col gap-4 rounded-lg p-4">
            {/* 전체 시그널 */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-secondary-200 text-sm font-semibold">
                        AI 분석
                    </span>
                    <span
                        className={cn(
                            'rounded border px-2 py-0.5 text-xs font-bold',
                            TREND_COLOR[analysis.trend],
                            'border-current'
                        )}
                    >
                        {TREND_LABEL[analysis.trend]}
                    </span>
                </div>
                <div className="text-secondary-400 flex items-center gap-1.5 text-xs">
                    <span>리스크</span>
                    <span
                        className={cn(
                            'font-semibold',
                            RISK_LEVEL_COLOR[analysis.riskLevel]
                        )}
                    >
                        {RISK_LEVEL_LABEL[analysis.riskLevel]}
                    </span>
                </div>
            </div>

            {/* 요약 */}
            <p className="text-secondary-300 text-sm leading-relaxed">
                {analysis.summary}
            </p>

            <div className="border-secondary-700 border-t" />

            {/* 시그널 목록 */}
            {allSignals.length > 0 && (
                <div className="flex flex-col gap-2">
                    <span className="text-secondary-500 text-xs font-semibold tracking-wide uppercase">
                        시그널
                    </span>
                    <div className="flex flex-col gap-1.5">
                        {allSignals.map(signal => (
                            <SignalItem
                                key={`${signal.type}-${signal.description}`}
                                signal={signal}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* 지지/저항 레벨 */}
            {(analysis.keyLevels.support.length > 0 ||
                analysis.keyLevels.resistance.length > 0) && (
                <div className="flex flex-col gap-2">
                    <span className="text-secondary-500 text-xs font-semibold tracking-wide uppercase">
                        주요 레벨
                    </span>
                    <div className="grid grid-cols-2 gap-3">
                        {analysis.keyLevels.resistance.length > 0 && (
                            <div className="flex flex-col gap-1">
                                <span className="text-secondary-500 text-xs">
                                    저항
                                </span>
                                {analysis.keyLevels.resistance.map(level => (
                                    <span
                                        key={level}
                                        className="text-sm font-medium text-red-400"
                                    >
                                        {level.toLocaleString()}
                                    </span>
                                ))}
                            </div>
                        )}
                        {analysis.keyLevels.support.length > 0 && (
                            <div className="flex flex-col gap-1">
                                <span className="text-secondary-500 text-xs">
                                    지지
                                </span>
                                {analysis.keyLevels.support.map(level => (
                                    <span
                                        key={level}
                                        className="text-sm font-medium text-teal-400"
                                    >
                                        {level.toLocaleString()}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* 재분석 버튼 */}
            <button
                type="button"
                onClick={onReanalyze}
                className="mt-1 w-full rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
            >
                재분석
            </button>
        </div>
    );
}
