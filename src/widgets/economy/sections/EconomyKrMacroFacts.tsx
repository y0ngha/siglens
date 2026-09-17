import { useTranslations } from 'next-intl';
import type { KrIndicatorCard } from '@/entities/economy';
import { KR_INDICATOR_EVENT } from '@/shared/config/economyIndicatorsKr';
import { cn } from '@/shared/lib/cn';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';

interface EconomyKrMacroFactsProps {
    readonly cards: readonly KrIndicatorCard[];
}

/**
 * `/economy/kr`의 SSR 사실 문단 — 미국판 `EconomyMacroFacts`와 같은 역할·같은 톤.
 *
 * 왜 필요한가: 이 라우트의 본문은 카드 그리드와 캘린더 표뿐이라, 크롤러가 받는
 * 산문이 FAQ 세 문항밖에 없었다(2026-09 구글 정책 감사 M8 — 미국 라우트에는 이
 * 문단이 있고 한국 라우트에만 없었다). 카드가 이미 들고 있는 값을 문장으로 다시
 * 쓰는 것이므로 추가 조회가 없고, 값이 없으면 그 문장을 통째로 뺀다(지어내지 않는다).
 *
 * AI 브리핑(미국판 `MacroBriefing`)의 한국 버전은 core+cron 작업이라 별도 이슈다.
 * 그때까지 이 문단이 유일한 산문이다.
 *
 * 서버 컴포넌트 — 상태가 없다.
 */
export function EconomyKrMacroFacts({ cards }: EconomyKrMacroFactsProps) {
    const t = useTranslations('widgets.economy');
    const tFacts = useTranslations('widgets.economy.krMacroFacts');

    const byEvent = new Map(
        cards.map(card => [card.meta.event, card] as const)
    );
    const format = (card: KrIndicatorCard | undefined): string | null =>
        card === undefined ? null : card.latest.toFixed(card.meta.precision);

    const baseRate = byEvent.get(KR_INDICATOR_EVENT.baseRate);
    const ktb10y = byEvent.get(KR_INDICATOR_EVENT.ktb10y);
    const cpi = byEvent.get(KR_INDICATOR_EVENT.cpi);
    const unemployment = byEvent.get(KR_INDICATOR_EVENT.unemployment);

    const baseRateValue = format(baseRate);
    const ktb10yValue = format(ktb10y);
    const cpiValue = format(cpi);
    const unemploymentValue = format(unemployment);

    const ratesSentence =
        baseRateValue !== null && ktb10yValue !== null
            ? tFacts('ratesWithKtb', { v0: baseRateValue, v1: ktb10yValue })
            : baseRateValue !== null
              ? tFacts('ratesOnly', { v0: baseRateValue })
              : null;

    const macroSentence =
        cpiValue !== null && unemploymentValue !== null
            ? tFacts('cpiAndUnemployment', {
                  v0: cpiValue,
                  v1: unemploymentValue,
              })
            : cpiValue !== null
              ? tFacts('cpiOnly', { v0: cpiValue })
              : unemploymentValue !== null
                ? tFacts('unemploymentOnly', { v0: unemploymentValue })
                : null;

    const cpiChange = cpi?.changeFromPrevious ?? null;
    const changeSentence =
        cpi !== undefined && cpiChange !== null
            ? tFacts('cpiChange', {
                  // 부호는 값에 붙인다 — 문장 안에 `+`를 두면 로케일마다 자리가
                  // 달라져 번역이 어긋난다(미국판과 같은 규칙).
                  v0: `${cpiChange >= 0 ? '+' : ''}${cpiChange.toFixed(cpi.meta.precision)}`,
              })
            : null;

    const sentences = [ratesSentence, macroSentence, changeSentence].filter(
        (sentence): sentence is string => sentence !== null
    );
    if (sentences.length === 0) return null;

    return (
        <section aria-labelledby="economy-kr-macro-facts-heading">
            <h2
                id="economy-kr-macro-facts-heading"
                className={cn('mb-3', HEADING_SECTION)}
            >
                {t('EconomyKrMacroFacts.59ed20')}
            </h2>
            <p className="text-sm leading-relaxed text-secondary-300">
                {sentences.join(' ')}
            </p>
        </section>
    );
}
