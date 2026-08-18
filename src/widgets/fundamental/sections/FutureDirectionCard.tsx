import { EmptySectionCard } from './EmptySectionCard';
import { InfoTooltip } from '@/shared/ui/InfoTooltip';
import { formatCompactCurrency } from '@/shared/lib/priceFormat';
import { isKrEquitySymbol } from '@/shared/config/marketProfile';
import type {
    FundamentalAnalystEstimateInput,
    FundamentalGradesConsensusInput,
    FundamentalPriceTargetConsensusInput,
    FundamentalPriceTargetSummaryInput,
} from '@y0ngha/siglens-core';
import type { CSSProperties, ReactNode } from 'react';

const HEADING_ID = 'future-heading';
const HEADING_CLASS_NAME = 'mb-4 text-lg font-semibold tracking-tight';

interface FutureDirectionCardProps {
    /** 표기 통화를 정하기 위해 필요하다 — 국내 종목은 원화다. */
    symbol: string;
    estimates: FundamentalAnalystEstimateInput | null;
    grades: FundamentalGradesConsensusInput | null;
    ptConsensus: FundamentalPriceTargetConsensusInput | null;
    ptSummary: FundamentalPriceTargetSummaryInput | null;
}

interface GradesBarProps {
    strongBuy: number;
    buy: number;
    hold: number;
    sell: number;
    strongSell: number;
}

function pct(value: number, total: number): string {
    return ((value / total) * 100).toFixed(1);
}

// 포매터 생성 비용을 렌더마다 물지 않도록 모듈 스코프에 고정한다. 통화별로 하나씩 —
// 국내 종목의 원화 금액에 `US$`를 붙이던 것이 이 카드에서 가장 크게 드러났다
// (`목표 주가 US$450,000`은 같은 사이트가 차트 탭에서 `₩274,500`으로 쓰는 값이다).
const MONEY_FORMATTERS: Record<'USD' | 'KRW', Intl.NumberFormat> = {
    USD: new Intl.NumberFormat('ko-KR', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 2,
    }),
    KRW: new Intl.NumberFormat('ko-KR', {
        style: 'currency',
        currency: 'KRW',
        maximumFractionDigits: 0,
    }),
};

function fmtMoney(v: number | null, symbol: string): string {
    if (v === null) return '—';
    return MONEY_FORMATTERS[isKrEquitySymbol(symbol) ? 'KRW' : 'USD'].format(v);
}

function fmtBig(v: number | null, symbol: string): string {
    return v !== null ? formatCompactCurrency(v, symbol) : '—';
}

function GradesBar({ strongBuy, buy, hold, sell, strongSell }: GradesBarProps) {
    const total = strongBuy + buy + hold + sell + strongSell;
    if (total === 0) return null;

    return (
        <div className="mt-3">
            <div className="flex overflow-hidden rounded-md" aria-hidden="true">
                {strongBuy > 0 && (
                    <div
                        title={`강력 매수 ${strongBuy}`}
                        className="h-3 w-(--bar-w) bg-ui-success"
                        style={
                            {
                                '--bar-w': `${pct(strongBuy, total)}%`,
                            } as CSSProperties
                        }
                    />
                )}
                {buy > 0 && (
                    <div
                        title={`매수 ${buy}`}
                        className="h-3 w-(--bar-w) bg-ui-success/60"
                        style={
                            {
                                '--bar-w': `${pct(buy, total)}%`,
                            } as CSSProperties
                        }
                    />
                )}
                {hold > 0 && (
                    <div
                        title={`중립 ${hold}`}
                        className="h-3 w-(--bar-w) bg-ui-warning"
                        style={
                            {
                                '--bar-w': `${pct(hold, total)}%`,
                            } as CSSProperties
                        }
                    />
                )}
                {sell > 0 && (
                    <div
                        title={`매도 ${sell}`}
                        className="h-3 w-(--bar-w) bg-ui-danger/60"
                        style={
                            {
                                '--bar-w': `${pct(sell, total)}%`,
                            } as CSSProperties
                        }
                    />
                )}
                {strongSell > 0 && (
                    <div
                        title={`강력 매도 ${strongSell}`}
                        className="h-3 w-(--bar-w) bg-ui-danger"
                        style={
                            {
                                '--bar-w': `${pct(strongSell, total)}%`,
                            } as CSSProperties
                        }
                    />
                )}
            </div>
            <dl className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                <div className="flex items-center gap-1">
                    <span
                        className="block h-2 w-2 rounded-sm bg-ui-success"
                        aria-hidden="true"
                    />
                    <dt className="text-secondary-400">강력 매수</dt>
                    <dd className="font-mono font-medium">{strongBuy}</dd>
                </div>
                <div className="flex items-center gap-1">
                    <span
                        className="block h-2 w-2 rounded-sm bg-ui-success/60"
                        aria-hidden="true"
                    />
                    <dt className="text-secondary-400">매수</dt>
                    <dd className="font-mono font-medium">{buy}</dd>
                </div>
                <div className="flex items-center gap-1">
                    <span
                        className="block h-2 w-2 rounded-sm bg-ui-warning"
                        aria-hidden="true"
                    />
                    <dt className="text-secondary-400">중립</dt>
                    <dd className="font-mono font-medium">{hold}</dd>
                </div>
                <div className="flex items-center gap-1">
                    <span
                        className="block h-2 w-2 rounded-sm bg-ui-danger/60"
                        aria-hidden="true"
                    />
                    <dt className="text-secondary-400">매도</dt>
                    <dd className="font-mono font-medium">{sell}</dd>
                </div>
                <div className="flex items-center gap-1">
                    <span
                        className="block h-2 w-2 rounded-sm bg-ui-danger"
                        aria-hidden="true"
                    />
                    <dt className="text-secondary-400">강력 매도</dt>
                    <dd className="font-mono font-medium">{strongSell}</dd>
                </div>
            </dl>
        </div>
    );
}

export function FutureDirectionCard({
    symbol,
    estimates,
    grades,
    ptConsensus,
    ptSummary,
}: FutureDirectionCardProps) {
    if (estimates === null && grades === null && ptConsensus === null) {
        return (
            <EmptySectionCard
                headingId={HEADING_ID}
                title="미래 방향"
                headingClassName={HEADING_CLASS_NAME}
            />
        );
    }

    return (
        <section
            aria-labelledby={HEADING_ID}
            className="rounded-xl border border-secondary-700 bg-secondary-800 p-6"
        >
            <h2 id={HEADING_ID} className={HEADING_CLASS_NAME}>
                전망과 목표가
            </h2>

            {estimates !== null && (
                <div className="mb-5">
                    <h3 className="mb-2 text-xs font-medium tracking-widest text-secondary-400 uppercase">
                        애널리스트 추정
                    </h3>
                    <dl className="grid grid-cols-2 gap-3">
                        <div className="rounded-lg bg-secondary-800/40 px-4 py-3">
                            <dt className="text-xs text-secondary-400">
                                EPS 컨센서스
                                <InfoTooltip>
                                    <p>
                                        애널리스트들이 예측한 EPS(주당순이익)의
                                        평균값이에요.
                                    </p>
                                    <p>
                                        실제 발표값이 이보다 높으면 &lsquo;어닝
                                        서프라이즈&rsquo;, 낮으면 &lsquo;어닝
                                        쇼크&rsquo;라고 불러요.
                                    </p>
                                </InfoTooltip>
                            </dt>
                            <dd className="mt-1 font-mono text-lg font-semibold tabular-nums">
                                {fmtMoney(estimates.estimatedEpsAvg, symbol)}
                            </dd>
                        </div>
                        <div className="rounded-lg bg-secondary-800/40 px-4 py-3">
                            <dt className="text-xs text-secondary-400">
                                매출 컨센서스
                                <InfoTooltip>
                                    <p>
                                        애널리스트들이 예측한 매출의
                                        평균값이에요.
                                    </p>
                                    <p>
                                        시장이 기대하는 성장 수준을 가늠할 수
                                        있는 지표예요.
                                    </p>
                                </InfoTooltip>
                            </dt>
                            <dd className="mt-1 font-mono text-lg font-semibold tabular-nums">
                                {fmtBig(estimates.estimatedRevenueAvg, symbol)}
                            </dd>
                        </div>
                    </dl>
                </div>
            )}

            {ptConsensus !== null && (
                <div className="mb-5">
                    <h3 className="mb-2 text-xs font-medium tracking-widest text-secondary-400 uppercase">
                        목표 주가
                    </h3>
                    <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
                        {
                            // TS infers (string | number | null)[][] from the entries array; the source
                            // data is structurally [string, number | null] per the priceTargetSummary shape.
                            (
                                [
                                    ['하단', ptConsensus.targetLow, undefined],
                                    [
                                        '중앙값',
                                        ptConsensus.targetMedian,
                                        undefined,
                                    ],
                                    [
                                        '컨센서스',
                                        ptConsensus.targetConsensus,
                                        <>
                                            <p>
                                                애널리스트들이 제시한 목표주가의
                                                평균이에요.
                                            </p>
                                            <p>
                                                현재 주가보다 높으면 상승 여력이
                                                있다고 보고, 낮으면 고평가
                                                신호로 해석해요.
                                            </p>
                                        </>,
                                    ],
                                    ['상단', ptConsensus.targetHigh, undefined],
                                ] as [
                                    string,
                                    number | null,
                                    ReactNode | undefined,
                                ][]
                            ) // 위 리터럴 entries가 항상 [라벨, ptConsensus 필드, tooltip?] 튜플이므로 narrowing 안전.
                                .map(([label, val, tooltip]) => (
                                    <div key={label}>
                                        <dt className="text-xs text-secondary-400">
                                            {label}
                                            {tooltip !== undefined && (
                                                <InfoTooltip>
                                                    {tooltip}
                                                </InfoTooltip>
                                            )}
                                        </dt>
                                        <dd className="font-mono text-sm font-medium tabular-nums">
                                            {fmtMoney(val, symbol)}
                                        </dd>
                                    </div>
                                ))
                        }
                    </dl>
                    {ptSummary !== null && (
                        <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs">
                            <div className="flex gap-1">
                                <dt className="text-secondary-400">1개월</dt>
                                <dd className="font-mono">
                                    {fmtMoney(
                                        ptSummary.lastMonth.avgPriceTarget,
                                        symbol
                                    )}
                                </dd>
                            </div>
                            <div className="flex gap-1">
                                <dt className="text-secondary-400">3개월</dt>
                                <dd className="font-mono">
                                    {fmtMoney(
                                        ptSummary.lastQuarter.avgPriceTarget,
                                        symbol
                                    )}
                                </dd>
                            </div>
                            <div className="flex gap-1">
                                <dt className="text-secondary-400">12개월</dt>
                                <dd className="font-mono">
                                    {fmtMoney(
                                        ptSummary.lastYear.avgPriceTarget,
                                        symbol
                                    )}
                                </dd>
                            </div>
                        </dl>
                    )}
                </div>
            )}

            {grades !== null && (
                <div>
                    <h3 className="mb-1 text-xs font-medium tracking-widest text-secondary-400 uppercase">
                        투자의견 컨센서스
                        <InfoTooltip>
                            <p>
                                애널리스트들이 매수·중립·매도 중 어떤 의견을
                                내고 있는지 분포예요.
                            </p>
                            <p>
                                매수 의견이 많을수록 시장의 긍정적 시각이
                                강하다는 뜻이에요.
                            </p>
                        </InfoTooltip>
                    </h3>
                    <GradesBar
                        strongBuy={grades.strongBuy}
                        buy={grades.buy}
                        hold={grades.hold}
                        sell={grades.sell}
                        strongSell={grades.strongSell}
                    />
                </div>
            )}
        </section>
    );
}
