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
    bullish: 'text-chart-bullish',
    bearish: 'text-chart-bearish',
    neutral: 'text-secondary-400',
};

const TREND_LABEL: Record<Trend, string> = {
    bullish: '상승',
    bearish: '하락',
    neutral: '중립',
};

const RISK_LEVEL_COLOR: Record<RiskLevel, string> = {
    low: 'text-chart-bullish',
    medium: 'text-chart-signal',
    high: 'text-chart-bearish',
};

const RISK_LEVEL_LABEL: Record<RiskLevel, string> = {
    low: '낮음',
    medium: '보통',
    high: '높음',
};

const SIGNAL_STRENGTH_COLOR: Record<SignalStrength, string> = {
    strong: 'text-chart-bullish',
    moderate: 'text-chart-signal',
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
    isAnalyzing: boolean;
    onReanalyze?: () => void;
}

export function AnalysisPanel({
    analysis,
    isAnalyzing,
    onReanalyze,
}: AnalysisPanelProps) {
    return (
        <div className="bg-secondary-800 flex flex-col gap-4 rounded-lg p-4">
            {/* 헤더 */}
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

            {/* 인디케이터 시그널 */}
            {analysis.signals.length > 0 && (
                <div className="flex flex-col gap-2">
                    <span className="text-secondary-500 text-xs font-semibold tracking-wide uppercase">
                        시그널
                    </span>
                    <div className="flex flex-col gap-1.5">
                        {analysis.signals.map(signal => (
                            <SignalItem
                                key={`${signal.type}-${signal.description}`}
                                signal={signal}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* 스킬 시그널 (skillName별 그룹핑) */}
            {analysis.skillSignals.length > 0 && (
                <div className="flex flex-col gap-3">
                    <span className="text-secondary-500 text-xs font-semibold tracking-wide uppercase">
                        패턴 / 스킬
                    </span>
                    {analysis.skillSignals.map(skillSignal => (
                        <div
                            key={skillSignal.skillName}
                            className="flex flex-col gap-1.5"
                        >
                            <span className="text-secondary-400 text-xs font-medium">
                                {skillSignal.skillName}
                            </span>
                            {skillSignal.signals.map(signal => (
                                <SignalItem
                                    key={`${signal.type}-${signal.description}`}
                                    signal={signal}
                                />
                            ))}
                        </div>
                    ))}
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
                                        key={`resistance-${level}`}
                                        className="text-chart-bearish text-sm font-medium"
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
                                        key={`support-${level}`}
                                        className="text-chart-bullish text-sm font-medium"
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
            {onReanalyze !== undefined && (
                <button
                    type="button"
                    onClick={onReanalyze}
                    disabled={isAnalyzing}
                    className="bg-primary-600 hover:bg-primary-700 disabled:bg-primary-600/50 mt-1 w-full rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed"
                >
                    {isAnalyzing ? '분석 중…' : '재분석'}
                </button>
            )}
        </div>
    );
}
