/**
 * Server-built content for `siglens.io/about`: the skill-count fallback, the
 * FAQ shared with the `FAQPage` JSON-LD, and the example reports the replay
 * plays.
 */
import 'server-only';
import type { SkillCounts } from '@y0ngha/siglens-core';
import { getTranslations } from 'next-intl/server';
import type { Locale } from '@/shared/i18n/locales';
import type { FaqItem } from '@/shared/lib/seo';
import {
    parseReplayLine,
    type ReplayLine,
    type ReplayScenario,
    type ReplayTool,
} from '@/shared/lib/replay/replayScript';
import type { AboutT } from './types';

/**
 * `countSkillFiles()` failing must not take the page down (an ISR render that
 * throws freezes an empty body), so the route falls back to these zeros and
 * logs. The copy reads "0종" in that case — wrong but harmless, and visible.
 */
export const EMPTY_SKILL_COUNTS: SkillCounts = {
    indicators: 0,
    candlesticks: 0,
    patterns: 0,
    strategies: 0,
    supportResistance: 0,
    fundamental: 0,
    news: 0,
};

/**
 * The FAQ as one array: the visible `FaqSection` and the `FAQPage` JSON-LD in
 * `app/[locale]/about/page.tsx` both read it, so the two can never drift
 * (Google requires the marked-up answers to be on the page).
 */
export async function getAboutFaq(locale: Locale): Promise<FaqItem[]> {
    const t = await getTranslations({ locale, namespace: 'views.about' });
    return [
        { question: t('faq.whatQ'), answer: t('faq.whatA') },
        { question: t('faq.freeQ'), answer: t('faq.freeA') },
        { question: t('faq.coverageQ'), answer: t('faq.coverageA') },
        { question: t('faq.accuracyQ'), answer: t('faq.accuracyA') },
        { question: t('faq.adviceQ'), answer: t('faq.adviceA') },
        { question: t('faq.aiQ'), answer: t('faq.aiA') },
        { question: t('faq.contactQ'), answer: t('faq.contactA') },
    ];
}

/** Per-step "work" time in the replay, in ms — long enough to read the chip. */
const STEP_MS = {
    bars: 520,
    indicators: 760,
    patterns: 640,
    fundamentals: 820,
    report: 1100,
} as const;

/**
 * A replay body line. `t.raw` is typed loosely because a key could hold a
 * nested object; every body line is a plain string in each catalog
 * (`messages/*.json`, checked by `i18n:verify`), so a non-string can only be a
 * catalog mistake and renders as an empty line rather than crashing the page.
 */
function replayLine(kind: ReplayLine['kind'], raw: unknown): ReplayLine {
    return parseReplayLine(kind, typeof raw === 'string' ? raw : '');
}

/** The financials step, whose chip names the ticker it reads. */
function fundamentalsStep(t: AboutT, subject: string): ReplayTool {
    return {
        label: t('replay.step.fundamentals'),
        pendingLabel: t('replay.step.fundamentalsPending'),
        subject,
        ms: STEP_MS.fundamentals,
    };
}

interface ScenarioInput {
    readonly id: string;
    readonly ticker: string;
    readonly tools: readonly ReplayTool[];
    readonly lines: readonly ReplayLine[];
    readonly time: string;
}

/**
 * One scenario. The report step is how the answer gets written, not data it
 * rests on, so it is left out of `sources`.
 */
function buildScenario(
    t: AboutT,
    report: ReplayTool,
    { id, ticker, tools, lines, time }: ScenarioInput
): ReplayScenario {
    return {
        id,
        question: ticker,
        tools,
        lines,
        summary: t('replay.summary', { count: tools.length }),
        sources: tools.filter(x => x !== report).map(x => x.label),
        asOf: t('replay.asOf', { time }),
    };
}

/**
 * Example reports for `ReportReplay`: a US stock, a Korean stock and a coin,
 * so the three markets SIGLENS covers each get a turn. The "question" is the
 * ticker typed into the address bar after `siglens.io/`.
 *
 * Every string is a literal `t()` / `t.raw()` call so the i18n extractor sees
 * the keys as used. Body lines go through `t.raw` because they carry
 * `<b>`/`<up>`/`<down>` markup that `replayScript` parses, not ICU rich text.
 */
export function buildReportScenarios(
    t: AboutT,
    counts: SkillCounts
): ReplayScenario[] {
    const bars: ReplayTool = {
        label: t('replay.step.bars'),
        pendingLabel: t('replay.step.barsPending'),
        subject: t('replay.subject.daily'),
        ms: STEP_MS.bars,
    };
    const indicators: ReplayTool = {
        label: t('replay.step.indicators'),
        pendingLabel: t('replay.step.indicatorsPending'),
        subject: t('replay.subject.kinds', { count: counts.indicators }),
        ms: STEP_MS.indicators,
    };
    const patterns: ReplayTool = {
        label: t('replay.step.patterns'),
        pendingLabel: t('replay.step.patternsPending'),
        subject: t('replay.subject.kinds', {
            count: counts.candlesticks + counts.patterns,
        }),
        ms: STEP_MS.patterns,
    };
    const report: ReplayTool = {
        label: t('replay.step.report'),
        pendingLabel: t('replay.step.reportPending'),
        subject: '',
        ms: STEP_MS.report,
    };
    const news: ReplayTool = {
        label: t('replay.step.news'),
        pendingLabel: t('replay.step.newsPending'),
        subject: '',
        ms: STEP_MS.fundamentals,
    };

    return [
        buildScenario(t, report, {
            id: 'aapl',
            ticker: 'AAPL',
            tools: [
                bars,
                indicators,
                patterns,
                fundamentalsStep(t, 'AAPL'),
                report,
            ],
            lines: [
                replayLine('p', t.raw('replay.aapl.a1')),
                replayLine('li', t.raw('replay.aapl.a2')),
                replayLine('li', t.raw('replay.aapl.a3')),
                replayLine('li', t.raw('replay.aapl.a4')),
                replayLine('p', t.raw('replay.aapl.a5')),
            ],
            time: t('replay.aapl.asOf'),
        }),
        buildScenario(t, report, {
            id: 'samsung',
            ticker: '005930.KS',
            tools: [
                bars,
                indicators,
                patterns,
                fundamentalsStep(t, '005930'),
                report,
            ],
            lines: [
                replayLine('p', t.raw('replay.samsung.a1')),
                replayLine('li', t.raw('replay.samsung.a2')),
                replayLine('li', t.raw('replay.samsung.a3')),
                replayLine('li', t.raw('replay.samsung.a4')),
                replayLine('p', t.raw('replay.samsung.a5')),
            ],
            time: t('replay.samsung.asOf'),
        }),
        buildScenario(t, report, {
            id: 'btc',
            ticker: 'BTCUSD',
            tools: [bars, indicators, patterns, news, report],
            lines: [
                replayLine('p', t.raw('replay.btc.a1')),
                replayLine('li', t.raw('replay.btc.a2')),
                replayLine('li', t.raw('replay.btc.a3')),
                replayLine('li', t.raw('replay.btc.a4')),
                replayLine('p', t.raw('replay.btc.a5')),
            ],
            time: t('replay.btc.asOf'),
        }),
    ];
}
