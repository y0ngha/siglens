import { cn } from '@/shared/lib/cn';

interface ReadoutRowProps {
    label: string;
    value: string;
    valueClassName?: string;
}

/** `<dl>` 안의 라벨·수치 한 줄 — 포지션 카드들의 리드아웃 행. */
export function ReadoutRow({ label, value, valueClassName }: ReadoutRowProps) {
    return (
        <div className="flex justify-between gap-4">
            <dt className="text-secondary-400">{label}</dt>
            <dd className={cn('tabular-nums', valueClassName)}>{value}</dd>
        </div>
    );
}
