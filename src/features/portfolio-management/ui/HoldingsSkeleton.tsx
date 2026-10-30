'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@/shared/lib/cn';
import { ROW_CHROME } from '../lib/holdingStyles';

const SKELETON_ROW_KEYS = [0, 1];

interface SkeletonLineProps {
    className: string;
}

function SkeletonLine({ className }: SkeletonLineProps) {
    return (
        <div
            className={cn('bg-secondary-700 animate-pulse rounded', className)}
        />
    );
}

/**
 * 보유종목 목록이 하이드레이션·조회를 기다리는 동안의 자리. 막대는 장식이라 숨기고, 상태 영역의
 * 보조 문구만 스크린 리더에 읽힌다.
 */
export function HoldingsSkeleton() {
    const t = useTranslations('features.portfolio-management');
    return (
        <div role="status" aria-busy="true" aria-live="polite">
            <span className="sr-only">{t('PortfolioSection.e8f6b4')}</span>
            <div className="space-y-2" aria-hidden="true">
                {SKELETON_ROW_KEYS.map(key => (
                    <div key={key} className={ROW_CHROME}>
                        <SkeletonLine className="h-4 w-24" />
                        <SkeletonLine className="mt-2 h-3 w-40" />
                    </div>
                ))}
            </div>
        </div>
    );
}
