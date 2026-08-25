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
 * 값에 모노를 쓰지 않는다. 네 값 중 둘이 `100개`·`10종목`이라 한글 단위가
 * 숫자에 붙어 있고, Geist Mono에는 한글 글리프가 없어 한 문자열이 두 서체로
 * 쪼개져 조판된다(실측: `개`가 같은 크기에서 44% 넓고 없는 폰트를 지정했을 때와
 * 폭이 같다 — 즉 폴백). 모노를 쓴 이유는 자릿수 정렬 하나뿐인데 그건
 * `tabular-nums`가 본문 서체에서 그대로 해 준다. 값을 숫자와 단위로 쪼개
 * 단위에만 다른 서체를 주는 방법도 있지만, 텍스트 노드가 갈리면 봇이 읽는
 * 문자열이 `100개`에서 `100 개`로 바뀐다.
 */
function StatCard({ value, label, valueClassName }: StatCardProps) {
    return (
        <div className="text-center">
            <div
                className={`text-3xl leading-none font-bold tabular-nums sm:text-4xl ${valueClassName}`}
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
                {/* 구분선(`w-px` 세로 규칙)을 두지 않는다. 구분선은 이 wrap
                    컨테이너의 flex 아이템이라 자기도 줄바꿈 대상이 되고, 그러면
                    어느 브레이크포인트를 잡아도 고아가 생긴다 — `sm`에 걸면
                    640~734px에서 줄 끝에 규칙 하나가 매달리고, `md`로 올리면
                    768px 이상에서 세 개가 통째로 둘째 줄로 밀린다(둘 다 실측).
                    애초에 대비가 다크 1.34:1 · 라이트 1.23:1로 3:1에 한참 못 미쳐
                    사실상 보이지 않는 장식이었다. 값마다 색이 다르고 아래에 라벨이
                    붙으며 최소 32px 간격이 있어, 구분선 없이도 넷은 각각 읽힌다. */}
                <div className="inline-flex flex-wrap items-center justify-center gap-x-8 gap-y-6 rounded-lg border border-secondary-700 bg-secondary-800 px-8 py-6">
                    <StatCard
                        value={`${meta.winRate}%`}
                        label="지표 신호 승률"
                        valueClassName="text-ui-success-text"
                    />
                    <StatCard
                        value={`${meta.aiWinRate}%`}
                        label="AI 예측 승률"
                        valueClassName="text-primary-400"
                    />
                    <StatCard
                        value={`${meta.totalCases}개`}
                        label="총 케이스"
                        valueClassName="text-ui-warning-text"
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
