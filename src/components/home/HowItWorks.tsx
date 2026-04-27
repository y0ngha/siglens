import { Fragment } from 'react';
import type { SkillCounts } from '@y0ngha/siglens-core';

export function HowItWorksSkeleton() {
    return (
        <section className="px-6 py-10 lg:px-[15vw]">
            <div className="bg-secondary-700/50 mb-6 h-3.5 w-24 animate-pulse rounded" />
            <div className="flex flex-col gap-4 md:flex-row">
                {[0, 1, 2].map(i => (
                    <Fragment key={i}>
                        <div className="bg-secondary-800/50 border-secondary-700 flex-1 rounded-lg border p-6">
                            <div className="bg-secondary-700/50 h-8 w-8 animate-pulse rounded" />
                            <div className="bg-secondary-700/50 mt-4 h-3.5 w-20 animate-pulse rounded" />
                            <div className="mt-2 space-y-1.5">
                                <div className="bg-secondary-700/50 h-3 w-full animate-pulse rounded" />
                                <div className="bg-secondary-700/50 h-3 w-4/5 animate-pulse rounded" />
                            </div>
                        </div>
                        {i < 2 && (
                            <div
                                className="hidden items-center md:flex"
                                aria-hidden="true"
                            >
                                <div className="bg-secondary-700/50 h-4 w-4 animate-pulse rounded" />
                            </div>
                        )}
                    </Fragment>
                ))}
            </div>
        </section>
    );
}

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
            description: '종목명, 심볼을 입력하면 차트가 렌더링됩니다',
        },
        {
            number: '02',
            title: '자동 분석',
            description: `보조지표 ${indicators}종, 캔들 패턴 ${candlesticks}종, 차트 패턴 ${patterns}종, 전략 ${strategies}종, 지지/저항 ${supportResistance}종 자동 분석`,
        },
        {
            number: '03',
            title: 'AI 리포트',
            description:
                '추세, 리스크, 진입 추천, 시그널, 차트 패턴, 전략 분석, 주요 지지/저항 레벨을 한 화면에서 확인',
        },
    ];
    return (
        <section className="px-6 py-10 lg:px-[15vw]">
            <h2 className="text-secondary-200 mb-6 text-sm font-semibold tracking-wider uppercase">
                이용 방법
            </h2>
            <div className="flex flex-col gap-4 md:flex-row">
                {STEPS.map((step, idx) => (
                    <Fragment key={step.number}>
                        <div className="bg-secondary-800/50 border-secondary-700 flex-1 rounded-lg border p-6">
                            <span
                                aria-hidden="true"
                                className="text-primary-600/40 font-mono text-3xl leading-none font-bold"
                            >
                                {step.number}
                            </span>
                            <h3 className="text-secondary-200 mt-4 text-sm font-semibold tracking-wider uppercase">
                                {step.title}
                            </h3>
                            <p className="text-secondary-400 mt-1 text-sm leading-relaxed">
                                {step.description}
                            </p>
                        </div>
                        {idx < STEPS.length - 1 && (
                            <div
                                className="text-secondary-600 hidden items-center text-xl md:flex"
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
