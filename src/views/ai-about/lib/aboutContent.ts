import 'server-only';
import { getTranslations } from 'next-intl/server';
import type { AiSeoCopy } from '@/shared/config/aiHost';
import type { Locale } from '@/shared/i18n/locales';
import type { FaqItem } from '@/shared/lib/seo';
import { GUEST_TURNS_PER_DAY } from '@/widgets/agent-chat';
import {
    parseReplayLine,
    type ReplayScenario,
    type ReplayTool,
} from './replayScript';

type AboutT = Awaited<ReturnType<typeof getTranslations>>;

/** Title, description and OG label for `/about`'s metadata. */
export async function getAboutSeoCopy(locale: Locale): Promise<AiSeoCopy> {
    const t = await getTranslations({ locale, namespace: 'views.ai-about' });
    return {
        title: t('seo.title'),
        description: t('seo.description'),
        ogLabel: t('seo.ogLabel'),
    };
}

/**
 * The FAQ as one array: the visible accordion and the `FAQPage` JSON-LD in
 * `app/ai/[locale]/about/page.tsx` both read it, so the two can never drift
 * (Google requires the marked-up answers to be on the page).
 */
export async function getAboutFaq(locale: Locale): Promise<FaqItem[]> {
    const t = await getTranslations({ locale, namespace: 'views.ai-about' });
    return [
        { question: t('faq.whatQ'), answer: t('faq.whatA') },
        { question: t('faq.diffQ'), answer: t('faq.diffA') },
        { question: t('faq.beginnerQ'), answer: t('faq.beginnerA') },
        { question: t('faq.adviceQ'), answer: t('faq.adviceA') },
        { question: t('faq.coverageQ'), answer: t('faq.coverageA') },
        {
            question: t('faq.priceQ'),
            answer: t('faq.priceA', { guest: GUEST_TURNS_PER_DAY }),
        },
        { question: t('faq.memberQ'), answer: t('faq.memberA') },
        { question: t('faq.wrongQ'), answer: t('faq.wrongA') },
    ];
}

/**
 * Example conversations for the replay. Every string is a literal `t()` /
 * `t.raw()` call so the i18n extractor sees the keys as used. Answer lines go
 * through `t.raw` because they carry `<b>`/`<up>`/`<down>` markup that
 * `replayScript` parses, not ICU rich text.
 */
export function buildScenarios(t: AboutT): ReplayScenario[] {
    // Answer lines are plain strings in every catalog (`messages/*.json`,
    // checked by `i18n:verify`); `t.raw` is typed loosely because a key could
    // hold a nested object, which none of these do.
    const tRaw = (key: string) => t.raw(key) as string;
    const tool = (label: string, subject: string, ms: number): ReplayTool => ({
        label,
        pendingLabel: t('replay.checking', { label }),
        subject,
        ms,
    });
    const scenario = (
        id: string,
        question: string,
        tools: ReplayTool[],
        lines: ReplayScenario['lines'],
        sources: string[],
        time: string
    ): ReplayScenario => ({
        id,
        question,
        tools,
        lines,
        summary: t('replay.summary', {
            tools: tools.map(x => x.label).join(' · '),
            seconds: (tools.reduce((sum, x) => sum + x.ms, 0) / 1000).toFixed(
                1
            ),
        }),
        sources,
        asOf: t('replay.asOf', { time }),
    });
    const quote = t('tool.quote');
    const bars = t('tool.bars');
    const news = t('tool.news');
    return [
        scenario(
            'samsung',
            t('samsung.q'),
            [
                tool(t('tool.search'), t('samsung.searchSubject'), 520),
                tool(quote, '005930', 640),
                tool(bars, '005930', 1100),
                tool(t('tool.analysis'), '005930', 780),
            ],
            [
                parseReplayLine('p', tRaw('samsung.a1')),
                parseReplayLine('li', tRaw('samsung.a2')),
                parseReplayLine('li', tRaw('samsung.a3')),
                parseReplayLine('li', tRaw('samsung.a4')),
                parseReplayLine('p', tRaw('samsung.a5')),
            ],
            [quote, bars, t('tool.analysis')],
            t('samsung.asOf')
        ),
        scenario(
            'nvda',
            t('nvda.q'),
            [
                tool(quote, 'NVDA', 600),
                tool(t('tool.company'), 'NVDA', 1000),
                tool(news, 'NVDA', 820),
            ],
            [
                parseReplayLine('p', tRaw('nvda.a1')),
                parseReplayLine('li', tRaw('nvda.a2')),
                parseReplayLine('li', tRaw('nvda.a3')),
                parseReplayLine('li', tRaw('nvda.a4')),
                parseReplayLine('p', tRaw('nvda.a5')),
            ],
            [quote, t('tool.company'), t('nvda.news')],
            t('nvda.asOf')
        ),
        scenario(
            'market',
            t('market.q'),
            [
                tool(t('tool.market'), t('market.subjectIndices'), 700),
                tool(t('tool.economy'), 'CPI · FOMC', 760),
                tool(news, t('market.subjectNews'), 900),
            ],
            [
                parseReplayLine('p', tRaw('market.a1')),
                parseReplayLine('li', tRaw('market.a2')),
                parseReplayLine('li', tRaw('market.a3')),
                parseReplayLine('li', tRaw('market.a4')),
                parseReplayLine('p', tRaw('market.a5')),
            ],
            [t('tool.market'), t('tool.economy'), t('market.news')],
            t('market.asOf')
        ),
        scenario(
            'btc',
            t('btc.q'),
            [
                tool(quote, 'BTC-USD', 560),
                tool(bars, 'BTC-USD', 1000),
                tool(t('tool.web'), t('btc.subjectWeb'), 1150),
            ],
            [
                parseReplayLine('p', tRaw('btc.a1')),
                parseReplayLine('li', tRaw('btc.a2')),
                parseReplayLine('li', tRaw('btc.a3')),
                parseReplayLine('li', tRaw('btc.a4')),
                parseReplayLine('p', tRaw('btc.a5')),
            ],
            [quote, bars, t('btc.web')],
            t('btc.asOf')
        ),
        scenario(
            'nvdaPro',
            t('nvdaPro.q'),
            [tool(quote, 'NVDA', 600), tool(t('tool.options'), 'NVDA', 1200)],
            [
                parseReplayLine('p', tRaw('nvdaPro.a1')),
                parseReplayLine('li', tRaw('nvdaPro.a2')),
                parseReplayLine('li', tRaw('nvdaPro.a3')),
                parseReplayLine('li', tRaw('nvdaPro.a4')),
                parseReplayLine('p', tRaw('nvdaPro.a5')),
            ],
            [quote, t('tool.options')],
            t('nvdaPro.asOf')
        ),
    ];
}
