import { Fragment } from 'react';
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
        <section className="px-6 py-10 lg:px-[15vw]">
            <h2 className="mb-6 text-sm font-semibold tracking-wider text-secondary-200 uppercase">
                이용 방법
            </h2>
            <div className="flex flex-col gap-4 md:flex-row">
                {STEPS.map((step, idx) => (
                    <Fragment key={step.number}>
                        <div className="flex-1 rounded-lg border border-secondary-700 bg-secondary-800/50 p-6">
                            <span
                                aria-hidden="true"
                                className="font-mono text-3xl leading-none font-bold text-primary-400/80"
                            >
                                {step.number}
                            </span>
                            <h3 className="mt-4 text-sm font-semibold tracking-wider text-secondary-200 uppercase">
                                {step.title}
                            </h3>
                            <p className="mt-1 text-sm leading-relaxed text-secondary-400">
                                {step.description}
                            </p>
                        </div>
                        {idx < STEPS.length - 1 && (
                            <div
                                className="hidden items-center text-xl text-secondary-500 md:flex"
                                aria-hidden="true"
                            >
                                →
                            </div>
                        )}
                    </Fragment>
                ))}
            </div>
        </section>
    );
}
