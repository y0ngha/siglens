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

type AboutT = Awaited<ReturnType<typeof getTranslations>>;

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
 * Example reports for `ReportReplay`: a US stock, a Korean stock and a coin,
 * so the three markets Siglens covers each get a turn. The "question" is the
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
    // Body lines are plain strings in every catalog (`messages/*.json`,
    // checked by `i18n:verify`); `t.raw` is typed loosely because a key could
    // hold a nested object, which none of these do.
    const tRaw = (key: string) => t.raw(key) as string;
    const step = (
        label: string,
        pendingLabel: string,
        subject: string,
        ms: number
    ): ReplayTool => ({ label, pendingLabel, subject, ms });

    const bars = step(
        t('replay.step.bars'),
        t('replay.step.barsPending'),
        t('replay.subject.daily'),
        STEP_MS.bars
    );
    const indicators = step(
        t('replay.step.indicators'),
        t('replay.step.indicatorsPending'),
        t('replay.subject.kinds', { count: counts.indicators }),
        STEP_MS.indicators
    );
    const patterns = step(
        t('replay.step.patterns'),
        t('replay.step.patternsPending'),
        t('replay.subject.kinds', {
            count: counts.candlesticks + counts.patterns,
        }),
        STEP_MS.patterns
    );
    const report = step(
        t('replay.step.report'),
        t('replay.step.reportPending'),
        '',
        STEP_MS.report
    );
    const fundamentals = (ticker: string) =>
        step(
            t('replay.step.fundamentals'),
            t('replay.step.fundamentalsPending'),
            ticker,
            STEP_MS.fundamentals
        );
    const news = step(
        t('replay.step.news'),
        t('replay.step.newsPending'),
        '',
        STEP_MS.fundamentals
    );

    const scenario = (
        id: string,
        ticker: string,
        tools: ReplayTool[],
        lines: ReplayLine[],
        time: string
    ): ReplayScenario => ({
        id,
        question: ticker,
        tools,
        lines,
        summary: t('replay.summary', { count: tools.length }),
        sources: tools.filter(x => x !== report).map(x => x.label),
        asOf: t('replay.asOf', { time }),
    });

    return [
        scenario(
            'aapl',
            'AAPL',
            [bars, indicators, patterns, fundamentals('AAPL'), report],
            [
                parseReplayLine('p', tRaw('replay.aapl.a1')),
                parseReplayLine('li', tRaw('replay.aapl.a2')),
                parseReplayLine('li', tRaw('replay.aapl.a3')),
                parseReplayLine('li', tRaw('replay.aapl.a4')),
                parseReplayLine('p', tRaw('replay.aapl.a5')),
            ],
            t('replay.aapl.asOf')
        ),
        scenario(
            'samsung',
            '005930.KS',
            [bars, indicators, patterns, fundamentals('005930'), report],
            [
                parseReplayLine('p', tRaw('replay.samsung.a1')),
                parseReplayLine('li', tRaw('replay.samsung.a2')),
                parseReplayLine('li', tRaw('replay.samsung.a3')),
                parseReplayLine('li', tRaw('replay.samsung.a4')),
                parseReplayLine('p', tRaw('replay.samsung.a5')),
            ],
            t('replay.samsung.asOf')
        ),
        scenario(
            'btc',
            'BTCUSD',
            [bars, indicators, patterns, news, report],
            [
                parseReplayLine('p', tRaw('replay.btc.a1')),
                parseReplayLine('li', tRaw('replay.btc.a2')),
                parseReplayLine('li', tRaw('replay.btc.a3')),
                parseReplayLine('li', tRaw('replay.btc.a4')),
                parseReplayLine('p', tRaw('replay.btc.a5')),
            ],
            t('replay.btc.asOf')
        ),
    ];
}
