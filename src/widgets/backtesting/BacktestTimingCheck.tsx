import { useTranslations } from 'next-intl';
import type { BacktestStats } from '@/entities/backtest-case/model';
import { cn } from '@/shared/lib/cn';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';
import { percentText, returnText, shareText } from './utils/percentText';
import { timingVerdict } from './utils/timingVerdict';

interface BacktestTimingCheckProps {
    stats: BacktestStats;
}

const EXCESS_DIGITS = 2;
const PARAGRAPH = 'text-sm leading-relaxed text-pretty text-secondary-300';

/**
 * "진입 시점의 효과" — 수익률이 AI의 진입 시점에서 왔는지를 같은 매매를 다른 기준에 견줘 본다.
 * 서버 컴포넌트이고 값은 모두 `stats.benchmarks`(생성기가 계산한 값)에서 그대로 읽는다.
 *
 * 판정 문장은 거래당 차이의 95% 범위로 정해지는 고정 문장이다(`timingVerdict`). 임의 날짜 시험의
 * 낙폭 비교에는 "손절가에서 바로 정리하는 규칙"이 임의 날짜 쪽에 없다는 점을 같은 문단에 적는다
 * — 그 차이가 진입 시점의 효과만은 아니기 때문이다.
 */
export function BacktestTimingCheck({ stats }: BacktestTimingCheckProps) {
    const t = useTranslations('widgets.backtesting.timing');
    const tHero = useTranslations('widgets.backtesting.hero');
    const { perTradeExcess, randomEntry, strategyMarkToMarketMaxDrawdownPct } =
        stats.benchmarks;
    const verdicts = {
        higher: t('verdictHigher'),
        lower: t('verdictLower'),
        none: t('verdictNone'),
    } as const;

    return (
        <section
            aria-labelledby="backtest-timing-heading"
            className="page-container py-6"
        >
            <div className={cn(SURFACE_CARD, 'px-4 py-5 sm:px-6')}>
                <h2
                    id="backtest-timing-heading"
                    className={cn(HEADING_SECTION, 'mb-3')}
                >
                    {t('heading')}
                </h2>
                <div className="space-y-3">
                    <p className={PARAGRAPH}>
                        {t('excess', {
                            v0: returnText(
                                perTradeExcess.meanPct,
                                EXCESS_DIGITS
                            ),
                            v1: returnText(
                                perTradeExcess.ci95.low,
                                EXCESS_DIGITS
                            ),
                            v2: returnText(
                                perTradeExcess.ci95.high,
                                EXCESS_DIGITS
                            ),
                            v3: perTradeExcess.n,
                        })}
                    </p>
                    <p className={PARAGRAPH}>
                        {verdicts[timingVerdict(perTradeExcess.ci95)]}
                    </p>
                    <p className={PARAGRAPH}>
                        {t('randomReturn', {
                            v0: randomEntry.draws,
                            v1: returnText(randomEntry.returnPct.p5),
                            v2: returnText(randomEntry.returnPct.p95),
                            v3: shareText(randomEntry.shareAboveStrategyReturn),
                        })}
                    </p>
                    <p className={PARAGRAPH}>
                        {t('randomDrawdown', {
                            v0: percentText(strategyMarkToMarketMaxDrawdownPct),
                            v1: shareText(randomEntry.shareWithSmallerDrawdown),
                        })}
                    </p>
                </div>
                <p className="mt-4 text-xs text-secondary-400">
                    {tHero('disclaimer')}
                </p>
            </div>
        </section>
    );
}
