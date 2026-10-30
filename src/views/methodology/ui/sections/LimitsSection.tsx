/**
 * `/methodology` "한계" — 분석이 보장하지 않는 것들.
 */
import { cn } from '@/shared/lib/cn';
import type { MethodologySectionProps } from '../../types';
import { MethodologySection } from '../layout/MethodologySection';
import { BULLET_LIST } from '../methodologyStyles';

/** 한계 다섯 줄의 글머리표 목록. */
export function LimitsSection({ t, title }: MethodologySectionProps) {
    const limits = [
        t('limits.wrong'),
        t('limits.past'),
        t('limits.personal'),
        t('limits.variance'),
        t('limits.levels'),
    ];
    return (
        <MethodologySection id="limits" title={title}>
            <ul className={cn(BULLET_LIST, 'mt-4')}>
                {limits.map(line => (
                    <li key={line}>{line}</li>
                ))}
            </ul>
        </MethodologySection>
    );
}
