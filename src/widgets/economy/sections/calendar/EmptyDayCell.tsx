/**
 * 이벤트 없는 날 — 숫자만 있는 비대화형 칸. 누를 수 있는 것처럼 보이지 않도록 버튼이 아니라
 * `<span>`이고, 색도 이벤트 있는 날보다 한 단계 낮춘다.
 */
import { cn } from '@/shared/lib/cn';

interface EmptyDayCellProps {
    day: number;
    isToday: boolean;
}

/** 날짜 숫자만 그린다(오늘이면 `aria-current`와 링). */
export function EmptyDayCell({ day, isToday }: EmptyDayCellProps) {
    return (
        <td className="p-0.5 align-top">
            <span
                aria-current={isToday ? 'date' : undefined}
                className={cn(
                    'block min-h-[4rem] rounded-lg p-1 text-right text-xs leading-none text-secondary-400 tabular-nums',
                    isToday && 'ring-secondary-500 font-bold ring-1'
                )}
            >
                {day}
            </span>
        </td>
    );
}
