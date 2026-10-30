import { useTranslations } from 'next-intl';
import type { BacktestCase } from '@y0ngha/siglens-core';
import { cn } from '@/shared/lib/cn';
import { formatSignedPercent } from '@/shared/lib/priceFormat';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import { AiPredictionPanel } from './ui/case-card/AiPredictionPanel';
import { ReturnSummary } from './ui/case-card/ReturnSummary';
import { TradeFlow } from './ui/case-card/TradeFlow';
import { CASE_CARD_VARIANT } from './utils/caseCardVariants';

interface BacktestCaseCardProps {
    case_: BacktestCase;
}

/**
 * 백테스트 케이스 한 건 카드 — 티커 링크, 진입→청산 흐름, 수익률, AI 요약·태그·예측 패널.
 * 조각은 `ui/case-card/`가 그리고 이 컴포넌트는 조립만 한다.
 */
export function BacktestCaseCard({ case_: c }: BacktestCaseCardProps) {
    const t = useTranslations('widgets.backtesting');
    const isWin = c.result === 'win';
    const v = CASE_CARD_VARIANT[c.result];
    const returnLabel = formatSignedPercent(c.returnPct);

    return (
        <article
            aria-label={`${c.ticker} ${c.entryDate} ${isWin ? t('BacktestCaseCard.bd6b14') : t('BacktestCaseCard.b19f09')} ${returnLabel}`}
            className={cn(SURFACE_CARD, 'p-3', v.article)}
        >
            <div className="mb-2 flex items-center gap-2">
                {/* 티커를 종목 페이지로 잇는다. 종목을 다루는 긴 페이지에서 심볼 페이지로
                    나가는 내부 링크가 이 배지뿐이다. */}
                <Link
                    href={`/${c.ticker}`}
                    // 목록에 종목 링크가 여러 개라 기본 prefetch면 뷰포트에 들어오는 즉시
                    // 종목 RSC를 개수만큼 당긴다.
                    prefetch={false}
                    translate="no"
                    className={cn(
                        'rounded px-2 py-0.5 text-xs font-bold transition-colors hover:brightness-110 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none',
                        v.badge
                    )}
                >
                    {c.ticker}
                </Link>
                <TradeFlow case_={c} />
                <ReturnSummary case_={c} returnLabel={returnLabel} />
            </div>

            {/* 면은 `SURFACE_NESTED`와 같은 표면값(`bg-secondary-700/40`)이다. 반경은 이
                자리의 `rounded-r`을 지켜야 해서 배경만 쓴다. raw `bg-black/20`은 테마를
                보지 않아 라이트 카드 위에서 페이지에서 가장 어두운 면이 된다. */}
            <p
                className={cn(
                    'text-secondary-400 rounded-r border-l-2 bg-secondary-700/40 px-3 py-2 text-xs leading-relaxed',
                    v.aiSummary
                )}
            >
                {c.aiAnalysis.summary}
            </p>

            {c.aiAnalysis.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                    {c.aiAnalysis.tags.map(tag => (
                        <span
                            key={tag}
                            className={cn(
                                'rounded px-1.5 py-0.5 text-xs',
                                v.tag
                            )}
                        >
                            {tag}
                        </span>
                    ))}
                </div>
            )}

            <AiPredictionPanel case_={c} />
        </article>
    );
}
