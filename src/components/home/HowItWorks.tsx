import { Fragment } from 'react';
import {
    CANDLESTICK_SKILL_COUNT,
    CHART_PATTERN_SKILL_COUNT,
    INDICATOR_KIND_COUNT,
    STRATEGY_SKILL_COUNT,
    SUPPORT_RESISTANCE_SKILL_COUNT,
} from '@/domain/indicators/constants';

const STEPS = [
    {
        number: '01',
        title: '티커 입력',
        description: '종목 심볼을 입력하면 차트가 렌더링됩니다',
    },
    {
        number: '02',
        title: '자동 분석',
        description: `보조지표 ${INDICATOR_KIND_COUNT}종 · 캔들 패턴 ${CANDLESTICK_SKILL_COUNT}종 · 차트 패턴 ${CHART_PATTERN_SKILL_COUNT}종 · 전략 ${STRATEGY_SKILL_COUNT}종 · 지지/저항 ${SUPPORT_RESISTANCE_SKILL_COUNT}종 자동 분석`,
    },
    {
        number: '03',
        title: 'AI 리포트',
        description:
            '추세·리스크·진입 추천 · 시그널 · 차트 패턴 · 전략 분석 · 주요 지지/저항 레벨을 한 화면에서 확인',
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
