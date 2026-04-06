import { Fragment } from 'react';
import { INDICATOR_KIND_COUNT } from '@/domain/indicators/constants';

const STEPS = [
    {
        number: '01',
        title: '티커 입력',
        description: '종목 심볼을 입력하면 차트가 렌더링됩니다',
    },
    {
        number: '02',
        title: '자동 분석',
        description: `${INDICATOR_KIND_COUNT}종 보조지표 자동 계산 + 패턴 감지`,
    },
    {
        number: '03',
        title: 'AI 리포트',
        description:
            '인디케이터·패턴·스킬을 종합한 분석 리포트와 지지/저항 레벨 생성',
    },
] as const;

export function HowItWorks() {
    return (
        <section className="px-6 py-16 lg:px-[15vw]">
            <div className="flex flex-col gap-4 md:flex-row">
                {STEPS.map((step, idx) => (
                    <Fragment key={step.number}>
                        <div className="bg-secondary-800/50 border-secondary-700 flex-1 rounded-lg border p-6">
                            <span className="text-primary-600/25 font-mono text-3xl leading-none font-bold">
                                {step.number}
                            </span>
                            <h2 className="text-secondary-200 mt-4 text-sm font-semibold tracking-wider uppercase">
                                {step.title}
                            </h2>
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
