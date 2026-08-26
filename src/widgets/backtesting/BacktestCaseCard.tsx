import Link from 'next/link';
import type { BacktestCase, BacktestRiskLevel } from '@y0ngha/siglens-core';
import { cn } from '@/shared/lib/cn';
import { formatUsdCurrency } from '@/shared/lib/priceFormat';

interface BacktestCaseCardProps {
    case_: BacktestCase;
}

interface EntryRecBadgeProps {
    recommendation: 'enter' | 'wait' | 'avoid';
}

function EntryRecBadge({ recommendation }: EntryRecBadgeProps) {
    const config = {
        enter: {
            label: 'AI 진입 권고',
            cls: 'bg-ui-success/10 text-ui-success-text border-ui-success/30',
        },
        avoid: {
            label: 'AI 회피 권고',
            cls: 'bg-ui-danger/10 text-ui-danger-text border-ui-danger/30',
        },
        wait: {
            label: 'AI 관망',
            cls: 'bg-secondary-800 text-secondary-400 border-secondary-700',
        },
    }[recommendation];
    return (
        <span
            translate="no"
            className={cn(
                'rounded border px-1.5 py-0.5 text-[9px] font-semibold',
                config.cls
            )}
        >
            {config.label}
        </span>
    );
}

interface RiskBadgeProps {
    level: BacktestRiskLevel;
}

function RiskBadge({ level }: RiskBadgeProps) {
    const isHigh = level === 'high' || level === 'extreme';
    const isLow = level === 'low';
    const cls = isHigh
        ? 'bg-ui-warning/10 text-ui-warning-text border-ui-warning/30'
        : isLow
          ? 'bg-ui-success/10 text-ui-success-text border-ui-success/30'
          : 'bg-secondary-800 text-secondary-400 border-secondary-700';
    return (
        <span
            className={cn(
                'rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase',
                cls
            )}
        >
            {level}
        </span>
    );
}

const winClasses = {
    article: 'border-secondary-700',
    badge: 'bg-secondary-700 text-primary-400',
    returnText: 'text-ui-success-text',
    aiSummary: 'border-chart-bullish',
    tag: 'border border-primary-900/50 bg-primary-950/40 text-primary-400',
} as const;

const lossClasses = {
    article: 'border-chart-bearish/20',
    badge: 'bg-chart-bearish/10 text-ui-danger-text',
    returnText: 'text-ui-danger-text',
    aiSummary: 'border-ui-warning',
    tag: 'border border-ui-warning/30 bg-ui-warning/10 text-ui-warning-text',
} as const;

export function BacktestCaseCard({ case_: c }: BacktestCaseCardProps) {
    const isWin = c.result === 'win';
    const v = isWin ? winClasses : lossClasses;
    const returnLabel = `${c.returnPct >= 0 ? '+' : ''}${c.returnPct.toFixed(1)}%`;

    const firstBullishTarget = c.aiAnalysis.bullishTargets[0];
    const showPredictionBlock =
        c.aiAnalysis.bullishTargets.length > 0 ||
        c.aiAnalysis.stopLoss !== undefined ||
        c.aiAnalysis.takeProfit !== undefined;

    return (
        <article
            aria-label={`${c.ticker} ${c.entryDate} ${isWin ? '수익' : '손실'} ${returnLabel}`}
            className={cn(
                'bg-secondary-800/50 rounded-lg border p-3',
                v.article
            )}
        >
            <div className="mb-2 flex items-center gap-2">
                {/*
                 * 티커를 종목 페이지로 잇는다. 10개 종목을 41.5k자에 걸쳐
                 * 다루면서 심볼 페이지로 나가는 내부 링크가 **하나도** 없었다
                 * (감사 실측: 앵커 43개가 전부 전역 nav/footer 크롬).
                 * 배지는 이미 시각적으로 구분되는 요소라 레이아웃이 그대로다.
                 */}
                <Link
                    href={`/${c.ticker}`}
                    translate="no"
                    className={cn(
                        'rounded px-2 py-0.5 text-xs font-bold transition-colors hover:brightness-110 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none',
                        v.badge
                    )}
                >
                    {c.ticker}
                </Link>

                <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto text-xs">
                    <div
                        className={cn(
                            'shrink-0 rounded border px-2 py-1',
                            c.signalType === 'buy'
                                ? 'border-chart-bullish/20 bg-chart-bullish/10'
                                : 'border-chart-bearish/20 bg-chart-bearish/10'
                        )}
                    >
                        {/* 배지 텍스트는 차트 색이 아니라 `ui-*-text`를 쓴다.
                            차트 색은 캔버스 배경 위에서 고른 값이라 `/10` 틴트
                            위에 얹으면 라이트 테마에서 4.10:1까지 떨어진다(실측).
                            `ui-*-text`는 바로 이 틴트 위를 겨냥해 만든 토큰이다. */}
                        <span
                            className={cn(
                                'font-semibold',
                                c.signalType === 'buy'
                                    ? 'text-ui-success-text'
                                    : 'text-ui-danger-text'
                            )}
                        >
                            {c.signalType === 'buy' ? '매수' : '매도'}
                        </span>
                        <span className="ml-1 text-secondary-400">
                            {c.entryDate}
                        </span>
                        <span className="ml-1 font-mono text-secondary-500 tabular-nums">
                            {formatUsdCurrency(c.entryPrice)}
                        </span>
                    </div>
                    <span
                        className="shrink-0 text-secondary-500"
                        aria-hidden="true"
                    >
                        →
                    </span>
                    <span className="shrink-0 text-[10px] whitespace-nowrap text-secondary-500">
                        <span className="tabular-nums">{c.holdingDays}</span>일
                    </span>
                    <span
                        className="shrink-0 text-secondary-500"
                        aria-hidden="true"
                    >
                        →
                    </span>
                    {/*
                     * 손절만 danger 배색이다. 예전에는 결과와 무관하게 항상
                     * 빨강이라, 수익 케이스 70건이 "초록 진입 → 빨강 청산"으로
                     * 읽혔다 — 이 페이지의 논지가 승률(70%)인데 배색이 그 반대를
                     * 말하고 있었다. 진입 칩이 `signalType`으로 갈리는 것과 같은
                     * 모양으로 청산도 `exitReason`으로 가른다.
                     */}
                    <div
                        className={cn(
                            'shrink-0 rounded border px-2 py-1 text-right',
                            c.exitReason === 'stop_loss'
                                ? 'border-chart-bearish/20 bg-chart-bearish/10'
                                : 'border-secondary-700 bg-secondary-800'
                        )}
                    >
                        <span
                            className={cn(
                                'font-semibold',
                                c.exitReason === 'stop_loss'
                                    ? 'text-ui-danger-text'
                                    : 'text-secondary-200'
                            )}
                        >
                            {c.exitReason === 'stop_loss' ? '손절' : '매도'}
                        </span>
                        <span className="ml-1 text-secondary-400">
                            {c.exitDate}
                        </span>
                        <span className="ml-1 font-mono text-secondary-500 tabular-nums">
                            {formatUsdCurrency(c.exitPrice)}
                        </span>
                    </div>
                </div>

                <div className="ml-auto flex shrink-0 items-center gap-1.5">
                    <span
                        className={cn(
                            'font-mono text-sm font-bold tabular-nums',
                            v.returnText
                        )}
                    >
                        {returnLabel}
                    </span>
                    <span
                        aria-hidden="true"
                        className={cn('text-xs', v.returnText)}
                    >
                        {isWin ? '✓' : '✗'}
                    </span>
                    <span className="sr-only">{isWin ? '수익' : '손실'}</span>
                </div>
            </div>

            <p
                className={cn(
                    // `bg-black/20`이었다. raw 리터럴이라 테마를 보지 않는데,
                    // 검은색을 얹는 동작이 두 테마에서 정반대다: 다크 카드
                    // 위에서는 1.019:1로 거의 안 보이는 미세 인셋이지만(의도),
                    // 흰 카드 위에서는 1.599:1로 **페이지에서 가장 어두운 면**이
                    // 되어 본문 산문이 비활성 코드블록처럼 읽힌다. master는
                    // 다크 전용이라 무해했고 라이트 테마를 들인 이 브랜치에서
                    // 처음 결함이 된다.
                    //
                    // `SURFACE_NESTED`의 표면값을 쓴다(반경은 이 자리의
                    // `rounded-r`을 지켜야 해서 상수 전체가 아니라 배경만).
                    // 다크 1.108 / 라이트 1.071로 양쪽이 대칭이다.
                    'text-secondary-400 line-clamp-3 rounded-r border-l-2 bg-secondary-700/40 px-3 py-2 text-[11px] leading-relaxed',
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
                                'rounded px-1.5 py-0.5 text-[10px]',
                                v.tag
                            )}
                        >
                            {tag}
                        </span>
                    ))}
                </div>
            )}

            {showPredictionBlock && (
                // 위 요약 밴드와 같은 인셋 처방. `bg-secondary-900/60`이었는데
                // 양 테마 모두 카드와 1.02:1이라 패널로 읽히지 않았다.
                <div className="mt-2 rounded bg-secondary-700/40 px-3 py-2 text-[10px] text-secondary-400">
                    <div className="mb-1 flex items-center gap-2">
                        <span className="text-xs font-semibold text-secondary-500">
                            AI 예측 레벨
                        </span>
                        <EntryRecBadge
                            recommendation={c.aiAnalysis.entryRecommendation}
                        />
                        {c.aiAnalysis.riskLevel && (
                            <RiskBadge level={c.aiAnalysis.riskLevel} />
                        )}
                    </div>

                    {/* `목표가:`·`✓ 도달` 같은 한글 라벨이 이 블록 안에 섞여 있어
                        모노를 걸 수 없다 — Geist Mono에 한글 글리프가 없어 한 줄이
                        두 서체로 조판된다. 여기서 모노가 하던 일은 가격 자릿수
                        정렬뿐이고 `tabular-nums`가 본문 서체에서 그대로 해 준다. */}
                    <div className="flex flex-wrap gap-x-3 gap-y-1 tabular-nums">
                        {firstBullishTarget && (
                            <div>
                                <span className="text-secondary-500">
                                    목표가:{' '}
                                </span>
                                <span className="text-ui-success-text">
                                    {formatUsdCurrency(
                                        firstBullishTarget.price
                                    )}
                                </span>
                                {c.aiTrendHit && (
                                    <span className="ml-1 text-ui-success-text">
                                        ✓ 도달
                                    </span>
                                )}
                            </div>
                        )}
                        {c.aiAnalysis.takeProfit !== undefined && (
                            <div>
                                <span className="text-secondary-500">TP: </span>
                                <span className="text-ui-success-text">
                                    {formatUsdCurrency(c.aiAnalysis.takeProfit)}
                                </span>
                                {c.exitReason === 'take_profit' && (
                                    <span className="ml-1 text-ui-success-text">
                                        ✓
                                    </span>
                                )}
                            </div>
                        )}
                        {c.aiAnalysis.stopLoss !== undefined && (
                            <div>
                                <span className="text-secondary-500">SL: </span>
                                <span className="text-ui-danger-text">
                                    {formatUsdCurrency(c.aiAnalysis.stopLoss)}
                                </span>
                                {c.exitReason === 'stop_loss' && (
                                    <span className="ml-1 text-ui-danger-text">
                                        ✓
                                    </span>
                                )}
                            </div>
                        )}
                    </div>

                    {firstBullishTarget?.basis && (
                        <p className="mt-1 line-clamp-1 text-[9px] text-secondary-500">
                            근거: {firstBullishTarget.basis}
                        </p>
                    )}
                </div>
            )}
        </article>
    );
}
