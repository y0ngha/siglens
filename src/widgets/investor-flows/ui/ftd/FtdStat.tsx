/**
 * 결제 불이행 요약 카드 한 장 — 라벨·값과, 값 아래 작은 글씨.
 */
import { cn } from '@/shared/lib/cn';
import { SURFACE_NESTED } from '@/shared/lib/surfaceStyles';

interface FtdStatProps {
    readonly label: string;
    readonly value: string;
    /** 값 아래 작은 글씨(최대치의 결제일 등). */
    readonly caption?: string | undefined;
}

/** `<ul>` 안에 놓는 `<li>` 카드. */
export function FtdStat({ label, value, caption }: FtdStatProps) {
    return (
        <li className={cn(SURFACE_NESTED, 'p-3')}>
            <p className="text-xs text-secondary-300">{label}</p>
            <p className="mt-1 text-sm font-semibold text-secondary-100 tabular-nums">
                {value}
            </p>
            {caption !== undefined && (
                <p className="mt-0.5 text-xs text-secondary-400 tabular-nums">
                    {caption}
                </p>
            )}
        </li>
    );
}
