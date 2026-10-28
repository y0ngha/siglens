/**
 * 포지션 카드들의 리드아웃 행 — 세 카드가 같은 행 모양(흐린 라벨, 오른쪽 tabular 숫자)을 쓰도록 한 곳에 둔다.
 */
import { cn } from '@/shared/lib/cn';

interface ReadoutRowProps {
    label: string;
    value: string;
    valueClassName?: string;
}

/** `<dl>` 안에 둔다 — 라벨은 `dt`, 값은 `dd`라 스크린 리더가 짝으로 읽는다. */
export function ReadoutRow({ label, value, valueClassName }: ReadoutRowProps) {
    return (
        <div className="flex justify-between gap-4">
            <dt className="text-secondary-400">{label}</dt>
            <dd className={cn('tabular-nums', valueClassName)}>{value}</dd>
        </div>
    );
}
