/**
 * `/methodology` "한눈에 보기" — 분석 하나가 거치는 네 단계.
 */
import { cn } from '@/shared/lib/cn';
import { HEADING_SUBSECTION } from '@/shared/lib/typographyStyles';
import type { MethodologySectionProps } from '../../types';
import { MethodologySection } from '../layout/MethodologySection';
import { CARD } from '../methodologyStyles';

/** 네 단계를 번호 카드로 보인다. 번호는 `<ol>`이 이미 전하므로 장식(`aria-hidden`)이다. */
export function OverviewSection({ t, title }: MethodologySectionProps) {
    const steps = [
        { name: t('overview.step1'), body: t('overview.step1Body') },
        { name: t('overview.step2'), body: t('overview.step2Body') },
        { name: t('overview.step3'), body: t('overview.step3Body') },
        { name: t('overview.step4'), body: t('overview.step4Body') },
    ];
    return (
        <MethodologySection id="overview" title={title} sub={t('overview.sub')}>
            <ol className="mt-6 grid gap-3 sm:grid-cols-2">
                {steps.map((step, i) => (
                    <li key={step.name} className={CARD}>
                        <span
                            aria-hidden="true"
                            className="flex size-7 items-center justify-center rounded-full border border-border-control text-xs font-semibold text-secondary-200 tabular-nums"
                        >
                            {i + 1}
                        </span>
                        <h3 className={cn(HEADING_SUBSECTION, 'mt-3')}>
                            {step.name}
                        </h3>
                        <p className="mt-1 text-sm leading-6 text-secondary-300">
                            {step.body}
                        </p>
                    </li>
                ))}
            </ol>
        </MethodologySection>
    );
}
