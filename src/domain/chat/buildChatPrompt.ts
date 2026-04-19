// IMPORTANT: System prompt strings must be written in English.
// Korean reduces LLM instruction-following consistency.

import type {
    AnalysisResponse,
    ChatMessage,
    ChatPromptPayload,
    KeyLevel,
    PriceScenario,
    Timeframe,
} from '@/domain/types';

function formatKeyLevels(levels: KeyLevel[]): string {
    if (levels.length === 0) return 'None detected';
    return levels.map(l => `${l.price.toFixed(2)} (${l.reason})`).join(', ');
}

function formatPriceTargets(
    scenario: PriceScenario | null | undefined
): string {
    if (!scenario || scenario.targets.length === 0) return 'None';
    return scenario.targets
        .map(t => `${t.price.toFixed(2)} — ${t.basis}`)
        .join('; ');
}

function formatIndicatorSignals(
    indicatorResults: AnalysisResponse['indicatorResults']
): string {
    return indicatorResults
        .flatMap(r =>
            r.signals.map(
                s => `• ${r.indicatorName}: ${s.trend} — ${s.description}`
            )
        )
        .join('\n');
}

function formatDetectedPatterns(
    patternSummaries: AnalysisResponse['patternSummaries']
): string {
    const detected = patternSummaries.filter(p => p.detected);
    if (detected.length === 0) return 'None detected';
    return detected.map(p => `${p.skillName} (${p.trend})`).join(', ');
}

export function buildChatPrompt(
    symbol: string,
    timeframe: Timeframe,
    analysis: AnalysisResponse,
    history: ChatMessage[],
    userMessage: string
): ChatPromptPayload {
    const rec = analysis.actionRecommendation;

    const systemPrompt = `You are an AI assistant helping a user understand a technical analysis report for ${symbol}.
Answer ONLY based on the analysis data provided below.
If asked about anything unrelated to this analysis (other stocks, general financial advice, predictions beyond this data), politely decline in Korean: "이 분석 결과와 관련된 질문만 답변할 수 있어요."

The user is NOT a technical trader — they may not know terms like RSI, MACD, or support levels.
Explain everything in plain, friendly Korean. Use natural analogies when they genuinely help understanding, but avoid forced comparisons.
Respond in Korean (한국어) in a warm, conversational tone.

=== ANALYSIS DATA ===
Symbol: ${symbol} | Timeframe: ${timeframe}
Overall Trend: ${analysis.trend} | Risk Level: ${analysis.riskLevel}

Summary:
${analysis.summary}
${
    rec
        ? `
Trading Strategy:
- Position Analysis: ${rec.positionAnalysis ?? 'N/A'}
- Entry: ${rec.entry ?? 'N/A'}
- Exit: ${rec.exit ?? 'N/A'}
- Risk/Reward: ${rec.riskReward ?? 'N/A'}
`
        : ''
}
Key Levels:
- Resistance: ${formatKeyLevels(analysis.keyLevels.resistance)}
- Support: ${formatKeyLevels(analysis.keyLevels.support)}

Detected Patterns: ${formatDetectedPatterns(analysis.patternSummaries)}

Indicator Signals:
${formatIndicatorSignals(analysis.indicatorResults) || 'None'}

Price Targets:
- Bullish scenario: ${formatPriceTargets(analysis.priceTargets.bullish)}
- Bearish scenario: ${formatPriceTargets(analysis.priceTargets.bearish)}
=== END ANALYSIS DATA ===`;

    const messages = [
        ...history.map(m => ({
            role: m.role,
            parts: [{ text: m.content }],
        })),
        { role: 'user' as const, parts: [{ text: userMessage }] },
    ];

    return { systemPrompt, messages };
}
