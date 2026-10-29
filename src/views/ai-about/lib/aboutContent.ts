/**
 * Server-side copy for `ai.siglens.io/about`: the metadata copy, the FAQ shared
 * with the `FAQPage` JSON-LD, and the example conversations for the replay.
 */
import 'server-only';
import { getTranslations } from 'next-intl/server';
import type { AiSeoCopy } from '@/shared/config/aiHost';
import { INTL_LOCALE, type Locale } from '@/shared/i18n/locales';
import type { FaqItem } from '@/shared/lib/seo';
import { GUEST_TURNS_PER_DAY } from '@/widgets/agent-chat/guestTurnLimit';
import {
    parseReplayLine,
    type ReplayLine,
    type ReplayScenario,
    type ReplayTool,
} from '@/shared/lib/replay/replayScript';

/** The `views.ai-about` translator the builders below read from. */
export type AboutT = Awaited<ReturnType<typeof getTranslations>>;

/**
 * Every example answer has the same shape: a lead paragraph, three bullets and
 * a closing paragraph. Fixing it here keeps the five scenarios from drifting.
 */
const ANSWER_LINE_KINDS = ['p', 'li', 'li', 'li', 'p'] as const;

/** One `t.raw` value per entry of {@link ANSWER_LINE_KINDS}. */
type AnswerRaws = { readonly [K in keyof typeof ANSWER_LINE_KINDS]: unknown };

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
 * The list format for the tool labels in a replay summary. The summary is a
 * translated sentence, so its list follows the locale too: a fixed `', '` puts
 * Latin commas into the ja/zh sentences, which separate list items with `、`.
 */
function toolListFormat(locale: Locale): Intl.ListFormat {
    return new Intl.ListFormat(INTL_LOCALE[locale], {
        style: 'long',
        type: 'conjunction',
    });
}

/**
 * Parses one answer's raw catalog strings into replay lines. Answer lines are
 * read with `t.raw` because they carry `<b>`/`<up>`/`<down>` markup that
 * `replayScript` parses, not ICU rich text; every catalog holds them as plain
 * strings (checked by `i18n:verify`), `t.raw` is only typed loosely because a
 * key could hold a nested object.
 */
function answerLines(raws: AnswerRaws): ReplayLine[] {
    return ANSWER_LINE_KINDS.map((kind, i) =>
        parseReplayLine(kind, raws[i] as string)
    );
}

/**
 * Example conversations for the replay. Every string is a literal `t()` /
 * `t.raw()` call so the i18n extractor sees the keys as used.
 */
export function buildScenarios(t: AboutT, locale: Locale): ReplayScenario[] {
    const toolList = toolListFormat(locale);
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
            tools: toolList.format(tools.map(x => x.label)),
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
            answerLines([
                t.raw('samsung.a1'),
                t.raw('samsung.a2'),
                t.raw('samsung.a3'),
                t.raw('samsung.a4'),
                t.raw('samsung.a5'),
            ]),
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
            answerLines([
                t.raw('nvda.a1'),
                t.raw('nvda.a2'),
                t.raw('nvda.a3'),
                t.raw('nvda.a4'),
                t.raw('nvda.a5'),
            ]),
            [quote, t('tool.company'), t('nvda.news')],
            t('nvda.asOf')
        ),
        scenario(
            'market',
            t('market.q'),
            [
                tool(t('tool.market'), t('market.subjectIndices'), 700),
                tool(t('tool.economy'), 'CPI, FOMC', 760),
                tool(news, t('market.subjectNews'), 900),
            ],
            answerLines([
                t.raw('market.a1'),
                t.raw('market.a2'),
                t.raw('market.a3'),
                t.raw('market.a4'),
                t.raw('market.a5'),
            ]),
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
            answerLines([
                t.raw('btc.a1'),
                t.raw('btc.a2'),
                t.raw('btc.a3'),
                t.raw('btc.a4'),
                t.raw('btc.a5'),
            ]),
            [quote, bars, t('btc.web')],
            t('btc.asOf')
        ),
        scenario(
            'nvdaPro',
            t('nvdaPro.q'),
            [tool(quote, 'NVDA', 600), tool(t('tool.options'), 'NVDA', 1200)],
            answerLines([
                t.raw('nvdaPro.a1'),
                t.raw('nvdaPro.a2'),
                t.raw('nvdaPro.a3'),
                t.raw('nvdaPro.a4'),
                t.raw('nvdaPro.a5'),
            ]),
            [quote, t('tool.options')],
            t('nvdaPro.asOf')
        ),
    ];
}
