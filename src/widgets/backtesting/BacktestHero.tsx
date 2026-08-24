import type { BacktestMeta } from '@y0ngha/siglens-core';

interface BacktestHeroProps {
    meta: BacktestMeta;
}

interface StatCardProps {
    value: string;
    label: string;
    valueClassName: string;
}

/*
 * 이 페이지의 유일한 논거는 숫자다. 이전에는 값이 18px, 라벨이 10px이라
 * h1(20px)과 사실상 같은 무게였고, "얼마나 정확한가"라는 질문에 대한 답이
 * 화면에서 눈에 띄지 않았다. 값은 display 크기로 올리고 라벨은 읽히는
 * 크기(12px)로 되돌린다.
 *
 * 숫자에만 모노를 쓰고 라벨은 본문 서체다 — 라벨에 한글이 섞이면 모노는
 * 글리프가 없어 OS 폰트로 떨어진다.
 */
function StatCard({ value, label, valueClassName }: StatCardProps) {
    return (
        <div className="text-center">
            <div
                className={`font-mono text-3xl leading-none font-bold tabular-nums sm:text-4xl ${valueClassName}`}
            >
                {value}
            </div>
            <div className="mt-2 text-xs text-secondary-400">{label}</div>
        </div>
    );
}

export function BacktestHero({ meta }: BacktestHeroProps) {
    return (
        <header className="border-b border-secondary-800 py-10 text-center">
            <div className="page-container">
                <p className="mb-2 font-mono text-[0.6875rem] tracking-[0.14em] text-secondary-400 uppercase">
                    BACKTESTING RESULTS · {meta.period}
                </p>
                <h1 className="mb-3 text-2xl font-bold text-balance text-secondary-50 sm:text-3xl">
                    Siglens가 얼마나 정확한가요?
                </h1>
                <p className="mx-auto mb-8 max-w-2xl text-sm leading-relaxed text-secondary-400 sm:text-base">
                    실제 시장 데이터로 검증한 백테스트 결과예요.
                    <br />
                    지금 Siglens가 제공하는 AI 분석 기능을 그대로 과거에
                    적용했을 때 얼마나 잘 맞았는지 보여드려요.
                </p>
                <div className="inline-flex flex-wrap items-center justify-center gap-x-8 gap-y-6 rounded-lg border border-secondary-700 bg-secondary-800 px-8 py-6 sm:gap-x-10">
                    <StatCard
                        value={`${meta.winRate}%`}
                        label="지표 신호 승률"
                        valueClassName="text-chart-bullish"
                    />
                    <div
                        className="hidden h-12 w-px bg-secondary-700 sm:block"
                        aria-hidden="true"
                    />
                    <StatCard
                        value={`${meta.aiWinRate}%`}
                        label="AI 예측 승률"
                        valueClassName="text-primary-400"
                    />
                    <div
                        className="hidden h-12 w-px bg-secondary-700 sm:block"
                        aria-hidden="true"
                    />
                    <StatCard
                        value={`${meta.totalCases}개`}
                        label="총 케이스"
                        valueClassName="text-ui-warning"
                    />
                    <div
                        className="hidden h-12 w-px bg-secondary-700 sm:block"
                        aria-hidden="true"
                    />
                    <StatCard
                        value={`${meta.tickerCount}종목`}
                        label="Mag7 + 선도주"
                        valueClassName="text-secondary-300"
                    />
                </div>
            </div>
        </header>
    );
}
