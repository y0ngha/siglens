import { useTranslations } from 'next-intl';
import { computeYieldSpread, type EconomySnapshot } from '@y0ngha/siglens-core';
import { cn } from '@/shared/lib/cn';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';

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
    const t = useTranslations('widgets.economy');
    const tFacts = useTranslations('widgets.economy.macroFacts');
    const { indicators, treasury } = snapshot;

    const seriesByName = new Map(indicators.map(s => [s.name, s] as const));

    const federalFunds =
        seriesByName.get('federalFunds')?.latest?.value ?? null;
    const cpi = seriesByName.get('CPI')?.latest?.value ?? null;
    const unemploymentRate =
        seriesByName.get('unemploymentRate')?.latest?.value ?? null;

    const year2 = treasury?.year2 ?? null;
    const year10 = treasury?.year10 ?? null;
    // core returns null when treasury is null or either yield component (year2/year10) is null —
    // matches the previous local guard: `year2 === null || year10 === null`.
    const spread = computeYieldSpread(treasury ?? null);

    const ratesSentence =
        federalFunds !== null &&
        year2 !== null &&
        year10 !== null &&
        spread !== null
            ? tFacts('ratesWithSpread', {
                  v0: federalFunds.toFixed(2),
                  v1: year2.toFixed(2),
                  v2: year10.toFixed(2),
                  // 부호는 값에 붙인다 — 문장 안에 `+`를 두면 로케일마다 자리가
                  // 달라져 번역이 어긋난다.
                  v3: `${spread >= 0 ? '+' : ''}${spread.toFixed(2)}`,
              })
            : federalFunds !== null
              ? tFacts('ratesOnly', { v0: federalFunds.toFixed(2) })
              : null;

    const macroSentence =
        cpi !== null && unemploymentRate !== null
            ? tFacts('cpiAndUnemployment', {
                  v0: cpi.toFixed(1),
                  v1: unemploymentRate.toFixed(1),
              })
            : cpi !== null
              ? tFacts('cpiOnly', { v0: cpi.toFixed(1) })
              : unemploymentRate !== null
                ? tFacts('unemploymentOnly', {
                      v0: unemploymentRate.toFixed(1),
                  })
                : null;

    if (ratesSentence === null && macroSentence === null) return null;

    return (
        <section aria-labelledby="economy-macro-facts-heading">
            <h2
                id="economy-macro-facts-heading"
                className={cn('mb-3', HEADING_SECTION)}
            >
                {t('EconomyMacroFacts.59ed20')}
            </h2>
            <p className="text-sm leading-relaxed text-secondary-300">
                {ratesSentence}
                {ratesSentence !== null && macroSentence !== null ? ' ' : null}
                {macroSentence}
            </p>
        </section>
    );
}
