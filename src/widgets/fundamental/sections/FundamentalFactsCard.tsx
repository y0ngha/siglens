/**
 * 펀더멘털 탭 "재무·수급 요약" — `entities/fundamental-facts`가 고른 사실을 한 문장씩 그린다.
 *
 * 크롤러가 이 탭에서 읽는 유일한 종목 고유 문장이라 서버 HTML에 그대로 실린다(Suspense 밖,
 * `serverDataSuspenseBoundaries`). 판단어("위험", "약세")와 권유 표현은 쓰지 않는다 — 숫자와
 * 사실만 적는다(SEO_RECOVERY R1). 사실이 없으면 아무것도 그리지 않는다.
 */
import { useTranslations } from 'next-intl';
import type { FundamentalFact } from '@/entities/fundamental-facts/model';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import type { Locale } from '@/shared/i18n/locales';
import {
    formatFactCount,
    formatFactDate,
    formatFactDecimal,
    formatFactSignedPercent,
    formatReportedAmount,
    formatTargetPrice,
    formatUsdAmount,
} from '@/widgets/fundamental/utils/factsFormat';

type Translator = ReturnType<typeof useTranslations<'widgets.fundamental'>>;

interface FactLine {
    readonly key: string;
    readonly sentences: readonly string[];
    readonly source: string;
}

interface FundamentalFactsCardProps {
    facts: readonly FundamentalFact[];
    symbol: string;
    displayName: string;
}

const HEADING_ID = 'fundamental-facts-heading';

/**
 * 공매도 문장. 빌더는 비율·상환일수 중 하나가 있을 때만 이 사실을 내므로 둘 다 `null`인 경우는 없다 —
 * 타입상 남는 그 경우는 빈 숫자를 문장에 끼우지 않고 출처 문구만 낸다.
 */
function shortInterestSentence(
    t: Translator,
    pct: string | null,
    days: string | null
): string {
    if (pct !== null && days !== null) {
        return t('FundamentalFactsCard.shortBoth', { pct, days });
    }
    if (pct !== null) return t('FundamentalFactsCard.shortPct', { pct });
    if (days !== null) return t('FundamentalFactsCard.shortDays', { days });
    return t('FundamentalFactsCard.shortSource');
}

function toLine(
    fact: FundamentalFact,
    t: Translator,
    symbol: string,
    locale: Locale
): FactLine {
    const date = (key: string) => formatFactDate(key, locale);
    // 개수는 숫자 그대로 넘긴다 — en 카탈로그가 ICU `plural`로 단수·복수를 고르고(`# filing`/`# filings`),
    // next-intl이 로케일 숫자 형식으로 찍는다.
    switch (fact.kind) {
        case 'cashRunway':
            return {
                key: fact.kind,
                sentences: [
                    t('FundamentalFactsCard.cashRunway', {
                        burn: formatReportedAmount(
                            fact.annualBurn,
                            fact.reportedCurrency,
                            symbol,
                            locale
                        ),
                        cash: formatReportedAmount(
                            fact.cash,
                            fact.reportedCurrency,
                            symbol,
                            locale
                        ),
                        years: formatFactDecimal(fact.years, locale),
                    }),
                ],
                source: t('FundamentalFactsCard.cashRunwaySource', {
                    date: date(fact.asOf),
                }),
            };
        case 'dilutionFilings':
            return {
                key: fact.kind,
                sentences: [
                    t('FundamentalFactsCard.dilution', {
                        days: fact.windowDays,
                        count: fact.filings,
                        atm: fact.atmFilings,
                        shelf: fact.shelfFilings,
                    }),
                ],
                source:
                    fact.latestFilingDate === null
                        ? t('FundamentalFactsCard.dilutionSource')
                        : t('FundamentalFactsCard.dilutionSourceDated', {
                              date: date(fact.latestFilingDate),
                          }),
            };
        case 'insiderTrades':
            return {
                key: fact.kind,
                sentences: [
                    t('FundamentalFactsCard.insiderUs', {
                        days: fact.windowDays,
                        buy: fact.buyCount,
                        buyValue: formatUsdAmount(fact.buyValueUsd, locale),
                        sell: fact.sellCount,
                        sellValue: formatUsdAmount(fact.sellValueUsd, locale),
                    }),
                ],
                source: t('FundamentalFactsCard.insiderUsSource'),
            };
        case 'insiderReportsKr':
            return {
                key: fact.kind,
                sentences: [
                    t('FundamentalFactsCard.insiderKr', {
                        reports: fact.reports,
                        reporters: fact.reporters,
                        net: formatFactCount(
                            fact.netSharesChange,
                            locale,
                            true
                        ),
                    }),
                ],
                source:
                    fact.latestReceiptDate === null
                        ? t('FundamentalFactsCard.insiderKrSource')
                        : t('FundamentalFactsCard.insiderKrSourceDated', {
                              date: date(fact.latestReceiptDate),
                          }),
            };
        case 'shortInterest': {
            const pct =
                fact.pctFloat === null
                    ? null
                    : formatFactDecimal(fact.pctFloat, locale);
            const days =
                fact.daysToCover === null
                    ? null
                    : formatFactDecimal(fact.daysToCover, locale);
            const sentence = shortInterestSentence(t, pct, days);
            return {
                key: fact.kind,
                sentences: [sentence],
                source:
                    fact.settlementDate === null
                        ? t('FundamentalFactsCard.shortSource')
                        : t('FundamentalFactsCard.shortSourceDated', {
                              date: date(fact.settlementDate),
                          }),
            };
        }
        case 'priceTarget': {
            const price = (v: number) => formatTargetPrice(v, symbol, locale);
            const sentences = [
                fact.low !== null && fact.high !== null
                    ? t('FundamentalFactsCard.targetRange', {
                          consensus: price(fact.consensus),
                          low: price(fact.low),
                          high: price(fact.high),
                      })
                    : t('FundamentalFactsCard.target', {
                          consensus: price(fact.consensus),
                      }),
            ];
            if (fact.buy + fact.hold + fact.sell > 0) {
                sentences.push(
                    t('FundamentalFactsCard.targetRatings', {
                        buy: fact.buy,
                        hold: fact.hold,
                        sell: fact.sell,
                    })
                );
            }
            if (fact.stale) {
                sentences.push(t('FundamentalFactsCard.targetStale'));
            }
            return {
                key: fact.kind,
                sentences,
                source: t('FundamentalFactsCard.targetSource'),
            };
        }
        case 'epsStreak':
            return {
                key: fact.kind,
                sentences: [
                    fact.direction === 'beat'
                        ? t('FundamentalFactsCard.epsBeat', {
                              count: fact.count,
                          })
                        : t('FundamentalFactsCard.epsMiss', {
                              count: fact.count,
                          }),
                ],
                source: t('FundamentalFactsCard.epsSource', {
                    date: date(fact.latestDate),
                }),
            };
        case 'nextEarnings': {
            const sentences = [
                t('FundamentalFactsCard.nextEarnings', {
                    date: date(fact.date),
                    days: fact.daysUntil,
                }),
            ];
            if (fact.lastSurprisePct !== null && fact.lastDate !== null) {
                sentences.push(
                    t('FundamentalFactsCard.lastSurprise', {
                        date: date(fact.lastDate),
                        pct: formatFactSignedPercent(
                            fact.lastSurprisePct,
                            locale
                        ),
                    })
                );
            }
            return {
                key: fact.kind,
                sentences,
                source: t('FundamentalFactsCard.nextEarningsSource'),
            };
        }
    }
}

export function FundamentalFactsCard({
    facts,
    symbol,
    displayName,
}: FundamentalFactsCardProps) {
    const t = useTranslations('widgets.fundamental');
    const locale = useResolvedLocale();
    if (facts.length === 0) return null;
    const lines = facts.map(fact => toLine(fact, t, symbol, locale));

    return (
        <section
            aria-labelledby={HEADING_ID}
            data-fundamental-facts=""
            className="flex flex-col gap-3 rounded-lg bg-secondary-800 p-4"
        >
            <h2
                id={HEADING_ID}
                className="text-sm font-semibold text-secondary-200"
            >
                {t('FundamentalFactsCard.heading', { name: displayName })}
            </h2>
            {/* 문장마다 블록을 따로 둔다 — 번역 문장을 공백으로 이어 붙이면 문장 사이 공백 규칙이
                다른 ja/zh에서 어긋난다(I18-14). 출처는 문장 아래 작은 줄이다. */}
            <ul className="space-y-3 text-sm leading-6 text-secondary-300">
                {lines.map(line => (
                    <li key={line.key}>
                        {line.sentences.map(sentence => (
                            <p key={sentence}>{sentence}</p>
                        ))}
                        <p className="text-xs text-secondary-500">
                            {line.source}
                        </p>
                    </li>
                ))}
            </ul>
            <p className="text-xs text-secondary-500">
                {t('FundamentalFactsCard.footnote')}
            </p>
        </section>
    );
}
