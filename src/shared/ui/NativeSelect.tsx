import type { ComponentProps } from 'react';
import { cn } from '@/shared/lib/cn';
import { ChevronDownIcon } from '@/shared/ui/StrokeIcons';

interface NativeSelectProps extends ComponentProps<'select'> {
    /** 바깥 래퍼 클래스(폭 지정 등). `className`은 `<select>` 자신에 붙는다. */
    wrapperClassName?: string;
}

/**
 * 브라우저 기본 `<select>`에 화살표만 직접 그린 셀렉트. 기본 화살표는 브라우저마다 위치·여백이
 * 달라 오른쪽 테두리에 붙어 보였다(메일 리포트 시간·관심종목 정렬). `appearance-none`으로 끄고
 * 오른쪽 여백(`pr-9`) 안에 아이콘을 둔다 — 옵션 목록은 여전히 OS 기본 UI라 모바일 휠 피커도 그대로다.
 * 포커스는 폼 입력과 같은 언어(테두리색 + 옅은 링)다.
 */
export function NativeSelect({
    className,
    wrapperClassName,
    children,
    ...rest
}: NativeSelectProps) {
    return (
        <span className={cn('relative inline-flex', wrapperClassName)}>
            <select
                {...rest}
                className={cn(
                    'h-10 w-full cursor-pointer touch-manipulation appearance-none rounded-lg border border-border-control bg-secondary-950 pr-9 pl-3 text-sm text-secondary-100 tabular-nums transition-colors outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/40 disabled:cursor-not-allowed disabled:text-secondary-500',
                    className
                )}
            >
                {children}
            </select>
            <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-secondary-400" />
        </span>
    );
}
