import { computeYieldSpread, type EconomySnapshot } from '@y0ngha/siglens-core';

interface EconomyMacroFactsProps {
    snapshot: EconomySnapshot;
}

/**
 * Server component — SSR text proxy for the MacroBriefing widget.
 *
 * MacroBriefing is 'use client' and initiates an AI job on mount, so crawlers
 * receive empty HTML for the briefing section. This component fills that gap
 * by rendering a concise, human-readable summary of key macro indicators that
 * are already available server-side (no additional fetch required).
 *
 * Rendered BEFORE `<MacroBriefing>` in EconomyContent so crawlers always see
 * factual data text even when the client-rendered AI briefing is not indexed.
 * When JS hydrates, MacroBriefing takes over with the full interactive AI briefing.
 *
 * Pattern mirrors `SectorFactsSummary` (market page) and `TechnicalFactsSummary`
 * (symbol chart page) — both are SSR fact proxies for client-only AI widgets.
 */
export function EconomyMacroFacts({ snapshot }: EconomyMacroFactsProps) {
    const { indicators, treasury } = snapshot;

    const seriesByName = new Map(indicators.map(s => [s.name, s] as const));

    const federalFunds =
        seriesByName.get('federalFunds')?.latest?.value ?? null;
    const cpi = seriesByName.get('CPI')?.latest?.value ?? null;
    const unemploymentRate =
        seriesByName.get('unemploymentRate')?.latest?.value ?? null;

    const year2 = treasury?.year2 ?? null;
    const year10 = treasury?.year10 ?? null;
    const spread = computeYieldSpread(treasury ?? null);

    const ratesSentence =
        federalFunds !== null &&
        year2 !== null &&
        year10 !== null &&
        spread !== null
            ? `현재 미국 기준금리는 ${federalFunds.toFixed(2)}%, 2년물·10년물 국채금리는 ${year2.toFixed(2)}%/${year10.toFixed(2)}%로 스프레드 ${spread >= 0 ? '+' : ''}${spread.toFixed(2)}%p입니다.`
            : federalFunds !== null
              ? `현재 미국 기준금리는 ${federalFunds.toFixed(2)}%입니다.`
              : null;

    const macroSentence =
        cpi !== null && unemploymentRate !== null
            ? `최신 소비자물가지수(CPI)는 ${cpi.toFixed(1)}pt, 실업률은 ${unemploymentRate.toFixed(1)}%입니다.`
            : cpi !== null
              ? `최신 소비자물가지수(CPI)는 ${cpi.toFixed(1)}pt입니다.`
              : unemploymentRate !== null
                ? `최신 실업률은 ${unemploymentRate.toFixed(1)}%입니다.`
                : null;

    if (ratesSentence === null && macroSentence === null) return null;

    return (
        <section aria-labelledby="economy-macro-facts-heading">
            <h2
                id="economy-macro-facts-heading"
                className="text-secondary-100 mb-3 text-xl font-semibold"
            >
                거시 경제 한눈에
            </h2>
            <p className="text-secondary-300 text-sm leading-relaxed">
                {ratesSentence}
                {ratesSentence !== null && macroSentence !== null ? ' ' : null}
                {macroSentence}
            </p>
        </section>
    );
}
