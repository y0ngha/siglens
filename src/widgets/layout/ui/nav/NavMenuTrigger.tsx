import type { ReactNode, Ref } from 'react';
import { cn } from '@/shared/lib/cn';

interface NavMenuTriggerProps {
    readonly ref: Ref<HTMLButtonElement>;
    readonly isOpen: boolean;
    readonly active: boolean;
    readonly panelId: string;
    readonly onClick: () => void;
    readonly children: ReactNode;
}

/**
 * 드롭다운 트리거 버튼(라벨 + 캐럿). `aria-expanded`가 상태의 단일 소스다.
 *
 * 라벨이 `시장 분석`·`공포·탐욕 지수` 같은 한글이라 uppercase는 무효고 0.12em 자간은
 * 자모를 흩뜨린다(`shared/lib/typographyStyles.ts`). 영어 라벨(`Fear & Greed Index`)은
 * 폭이 모자라면 트리거 안에서 줄바꿈돼 행 밖으로 삐져나가므로 `whitespace-nowrap`이다.
 */
export function NavMenuTrigger({
    ref,
    isOpen,
    active,
    panelId,
    onClick,
    children,
}: NavMenuTriggerProps) {
    return (
        <button
            ref={ref}
            type="button"
            aria-expanded={isOpen}
            aria-controls={panelId}
            onClick={onClick}
            className={cn(
                '-mb-px flex min-h-11 touch-manipulation items-center gap-1 border-b-2 px-2 text-sm font-semibold whitespace-nowrap transition-colors focus-visible:rounded focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none',
                active
                    ? 'border-primary-500 text-secondary-100'
                    : 'border-transparent text-secondary-400 hover:text-secondary-100'
            )}
        >
            {children}
            <span
                aria-hidden="true"
                className={cn(
                    'text-[0.6rem] transition-transform',
                    isOpen && 'rotate-180'
                )}
            >
                ▾
            </span>
        </button>
    );
}
