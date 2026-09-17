import { useTranslations } from 'next-intl';
import type { BacktestStats } from '@/entities/backtest-case';
import { cn } from '@/shared/lib/cn';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';

interface BacktestHeroProps {
    stats: BacktestStats;
}

interface StatCardProps {
    value: string;
    label: string;
    valueClassName: string;
    subLabel?: string;
}

/**
 * `YYYY-MM-DD` → `YYYY.MM`. Deliberately not run through next-intl — the
 * `BACKTESTING RESULTS ·` kicker above it is itself an untranslated Latin
 * label in every locale, so the date segment stays in the same plain,
 * locale-invariant format.
 */
function formatPeriodMonth(isoDate: string): string {
    return isoDate.slice(0, 7).replace('-', '.');
}

/*
 * 이 페이지의 유일한 논거는 숫자다. 이전에는 값이 18px, 라벨이 10px이라
 * h1(20px)과 사실상 같은 무게였고, "얼마나 정확한가"라는 질문에 대한 답이
 * 화면에서 눈에 띄지 않았다. 값은 display 크기로 올리고 라벨은 읽히는
 * 크기(12px)로 되돌린다.
 *
 * 값에 모노를 쓰지 않는다. 네 값 중 둘이 `100개`·`10종목`이라 한글 단위가
 * 숫자에 붙어 있고, Geist Mono에는 한글 글리프가 없어 한 문자열이 두 서체로
 * 쪼개져 조판된다(실측: `개`가 같은 크기에서 44% 넓고 없는 폰트를 지정했을 때와
 * 폭이 같다 — 즉 폴백). 모노를 쓴 이유는 자릿수 정렬 하나뿐인데 그건
 * `tabular-nums`가 본문 서체에서 그대로 해 준다. 값을 숫자와 단위로 쪼개
 * 단위에만 다른 서체를 주는 방법도 있지만, 텍스트 노드가 갈리면 봇이 읽는
 * 문자열이 `100개`에서 `100 개`로 바뀐다.
 *
 * 정렬은 가운데가 아니라 **왼쪽**이다. 서브라벨 길이가 카드마다 크게 달라
 * (`93/150` 대 `결정 케이스 14/20 · 중립 130건 제외`) 가운데 정렬에서는 값이
 * 카드마다 다른 x에 떠 표처럼 읽히지 않았다(사용자 제보). 왼쪽 정렬 + 그리드면
 * 값·라벨·서브라벨이 열마다 같은 선에서 시작한다.
 */
function StatCard({ value, label, valueClassName, subLabel }: StatCardProps) {
    return (
        <div className="text-left">
            <div
                className={cn(
                    'text-3xl leading-none font-bold tabular-nums sm:text-4xl',
                    valueClassName
                )}
            >
                {value}
            </div>
            <div className="mt-2 text-xs text-secondary-400">{label}</div>
            {/* 서브라벨이 없는 카드도 이 슬롯을 그대로 그린다 — 있는 카드와
                바닥선을 맞추려면 한 줄치 높이를 항상 예약해야 한다. */}
            <div
                data-testid="stat-sub-label"
                className="mt-0.5 min-h-4 text-[0.6875rem] text-secondary-500"
            >
                {subLabel}
            </div>
        </div>
    );
}

export function BacktestHero({ stats }: BacktestHeroProps) {
    const t = useTranslations('widgets.backtesting');
    const tHero = useTranslations('widgets.backtesting.hero');
    const period = `${formatPeriodMonth(stats.periodStart)} – ${formatPeriodMonth(stats.periodEnd)}`;
    const meanReturnDisplay = `${stats.meanReturnPct >= 0 ? '+' : ''}${stats.meanReturnPct}%`;

    return (
        <header className="border-b border-secondary-700 py-10 text-center">
            <div className="page-container">
                <p className="mb-2 font-mono text-[0.6875rem] tracking-[0.14em] text-secondary-400 uppercase">
                    BACKTESTING RESULTS · {period}
                </p>
                <h1 className="mb-3 text-2xl font-bold text-balance text-secondary-50 sm:text-3xl">
                    {t('BacktestHero.d8b543')}
                </h1>
                <p className="mx-auto mb-8 max-w-2xl text-sm leading-relaxed text-secondary-400 sm:text-base">
                    {t('BacktestHero.116858')}
                    <br />
                    {t('BacktestHero.caee31')}
                </p>
                {/* wrap flex가 아니라 **그리드**다. flex는 카드를 내용 폭대로
                    흘려보내 열이 줄마다 어긋났고, `items-center`가 카드 높이를
                    서로 다르게 잡아 값이 위아래로 떴다. 그리드는 열 폭과 각 셀의
                    시작선을 고정해 여섯 지표가 표처럼 읽힌다.

                    구분선(`w-px` 세로 규칙)은 여전히 두지 않는다. 대비가 다크
                    1.34:1 · 라이트 1.23:1로 3:1에 한참 못 미쳐 사실상 보이지 않는
                    장식이었다. 값마다 색이 다르고 아래에 라벨이 붙으며 최소 32px
                    간격이 있어, 구분선 없이도 여섯은 각각 읽힌다. */}
                <div
                    className={cn(
                        SURFACE_CARD,
                        'grid grid-cols-2 gap-x-8 gap-y-6 px-8 py-6 text-left sm:grid-cols-3 lg:grid-cols-6'
                    )}
                >
                    <StatCard
                        value={`${stats.indicatorWinRate}%`}
                        label={t('BacktestHero.394fff')}
                        valueClassName="text-ui-success-text"
                        subLabel={`${stats.indicatorWins}/${stats.totalCases}`}
                    />
                    <StatCard
                        value={`${stats.aiWinRateDecisive}%`}
                        label={t('BacktestHero.5a254c')}
                        valueClassName="text-primary-400"
                        subLabel={tHero('aiSubLabel', {
                            v0: stats.aiWins,
                            v1: stats.aiDecisiveCount,
                            v2: stats.aiNeutralCount,
                        })}
                    />
                    <StatCard
                        value={`${stats.aiTrendHitRate}%`}
                        label={t('BacktestHero.aiTrendHitRateLabel')}
                        valueClassName="text-secondary-300"
                    />
                    <StatCard
                        value={meanReturnDisplay}
                        label={t('BacktestHero.meanReturnLabel')}
                        valueClassName={
                            stats.meanReturnPct >= 0
                                ? 'text-ui-success-text'
                                : 'text-ui-danger-text'
                        }
                    />
                    <StatCard
                        value={tHero('caseCount', { v0: stats.totalCases })}
                        label={t('BacktestHero.f92294')}
                        valueClassName="text-ui-warning-text"
                    />
                    <StatCard
                        value={tHero('medianHoldingDays', {
                            v0: stats.medianHoldingDays,
                        })}
                        label={t('BacktestHero.medianHoldingDaysLabel')}
                        valueClassName="text-secondary-300"
                    />
                </div>
            </div>
        </header>
    );
}
