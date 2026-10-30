/**
 * 신호 소절 머리줄 — 마커·제목·안내 툴팁·종목 수.
 */
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';
import { InfoTooltip } from '@/shared/ui/InfoTooltip';
import {
    VARIANT_COUNT_DIM,
    VARIANT_LABEL,
    type SignalSubsectionVariant,
} from '../../utils/subsectionStyles';

const COUNT_PAD_LENGTH = 2;

interface SubsectionHeaderProps {
    title: string;
    marker: string;
    variant: SignalSubsectionVariant;
    count: number;
    infoMessage?: ReactNode;
}

/**
 * 종목 수는 20px 모노 숫자로 제목(16px)보다 크지만, 제목이 굵기에서 앞서고 모노 숫자가
 * 같은 크기의 한글보다 작게 읽혀 위계는 제목이 가져간다. 대비 우위가 변형마다 뒤집히지
 * 않도록 불투명도는 제목과 같은 값을 쓴다(`VARIANT_COUNT_DIM`).
 */
export function SubsectionHeader({
    title,
    marker,
    variant,
    count,
    infoMessage,
}: SubsectionHeaderProps) {
    const t = useTranslations('widgets.dashboard');
    return (
        <div className="mb-3 flex items-baseline justify-between">
            <div className="flex items-center gap-2">
                <h3
                    className={cn(
                        'text-secondary-100 text-base tracking-tight text-pretty',
                        VARIANT_LABEL[variant]
                    )}
                >
                    <span aria-hidden="true" className="mr-2">
                        {marker}
                    </span>
                    {title}
                </h3>
                {infoMessage !== undefined && infoMessage !== null && (
                    <InfoTooltip>
                        <div className="text-secondary-300">{infoMessage}</div>
                    </InfoTooltip>
                )}
            </div>
            <span
                className={cn(
                    'font-mono text-xl text-secondary-200 tabular-nums',
                    VARIANT_COUNT_DIM[variant]
                )}
                aria-label={t('stockCount', { v0: count })}
            >
                {count.toString().padStart(COUNT_PAD_LENGTH, '0')}
            </span>
        </div>
    );
}
