import type { SkillCounts } from '@y0ngha/siglens-core';

interface HowItWorksProps {
    skillCounts: SkillCounts;
}

export function HowItWorks({ skillCounts }: HowItWorksProps) {
    const {
        indicators,
        candlesticks,
        patterns,
        strategies,
        supportResistance,
    } = skillCounts;

    const STEPS = [
        {
            number: '01',
            title: '종목 입력',
            description: '종목명이나 심볼을 입력하면 차트가 바로 그려져요',
        },
        {
            number: '02',
            title: '자동 분석',
            description: `보조지표 ${indicators}종, 캔들 패턴 ${candlesticks}종, 차트 패턴 ${patterns}종, 전략 ${strategies}종, 지지·저항선 ${supportResistance}종을 자동으로 분석해요`,
        },
        {
            number: '03',
            title: 'AI 리포트',
            description:
                '추세와 리스크, 매수 진입 가이드, 매매 신호, 차트 패턴, 전략, 주요 지지·저항선까지 한 화면에서 확인할 수 있어요',
        },
    ];
    return (
        <section className="page-container py-10">
            {/*
                이전에는 3등분 카드 그리드 + `01/02/03` 대형 모노 숫자 + 카드
                사이 `→` 글리프였다. 감사가 이 제품에서 가장 템플릿처럼 읽히는
                블록으로 지목한 구성이며, 실제로 세 항목의 무게가 완전히 같아
                "순서가 있는 절차"라는 정보가 형태로 전달되지 않았다.

                순서가 실제 정보이므로 번호는 남기되, 카드를 걷어내고 룰로
                구분되는 행으로 바꾼다. 번호는 장식이 아니라 행의 좌표라서
                작고 흐리게 두고, 굵기와 크기는 제목이 가져간다. 문구는 한 글자도
                바꾸지 않았다 — 이 텍스트는 홈의 HowTo 구조화데이터와 1:1로
                묶여 있어 줄어들면 SEO 자산이 함께 줄어든다.
            */}
            <h2 className="mb-6 text-sm font-semibold text-secondary-200">
                이용 방법
            </h2>
            <ol className="border-t border-secondary-800">
                {STEPS.map(step => (
                    <li
                        key={step.number}
                        className="grid grid-cols-[2.5rem_1fr] items-baseline gap-x-4 border-b border-secondary-800 py-5 sm:grid-cols-[3rem_10rem_1fr] sm:gap-x-6"
                    >
                        <span
                            aria-hidden="true"
                            className="font-mono text-sm text-secondary-500 tabular-nums"
                        >
                            {step.number}
                        </span>
                        <h3 className="text-base font-semibold text-secondary-100">
                            {step.title}
                        </h3>
                        <p className="col-span-2 mt-1 text-sm leading-relaxed text-secondary-400 sm:col-span-1 sm:mt-0">
                            {step.description}
                        </p>
                    </li>
                ))}
            </ol>
        </section>
    );
}
