/**
 * 차트 헤더 팝오버 메뉴가 공유하는 행 스타일·체크박스·설정 행 컴포넌트.
 */

import { cn } from '@/shared/lib/cn';
import { CheckIcon } from '@/shared/ui/StrokeIcons';

// 터치 기기(`pointer: coarse`)에서만 44px 행 — 스크롤되는 메뉴에서 인접 행을 잘못
// 누르지 않게 한다(`ModelListbox` 행과 같은 규약). 마우스에서는 32px로 촘촘히 둔다.
export const MENU_ROW_CLASS =
    'flex min-h-8 w-full touch-manipulation items-center gap-2.5 rounded-lg px-2 text-left text-xs transition-colors hover:bg-secondary-800 focus-visible:ring-1 focus-visible:ring-primary-500 focus-visible:outline-none pointer-coarse:min-h-11';

export type CheckState = boolean | 'mixed';

/**
 * 켜짐 표시 — 행 전체를 칠하지 않고 앞쪽 체크박스 하나로 말한다. 예전엔 켜진 행마다
 * 배경을 채워 블록이 겹겹이 쌓여 보였다(사용자 피드백). 상태 전달은 버튼의
 * `aria-pressed`가 맡고, 이 도형은 장식이다.
 */
export function CheckBox({ state }: { state: CheckState }) {
    return (
        <span
            aria-hidden="true"
            className={cn(
                'flex size-4 shrink-0 items-center justify-center rounded border transition-colors',
                state === false
                    ? 'border-secondary-500'
                    : 'border-primary-500 bg-primary-600 text-white'
            )}
        >
            {state === true && <CheckIcon className="size-3" />}
            {state === 'mixed' && (
                <span className="h-0.5 w-2 rounded-full bg-current" />
            )}
        </span>
    );
}

interface SettingRowProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
    label: string;
}

/** 표시 환경설정 한 줄 — 체크박스 + 라벨이 든 토글 버튼(`aria-pressed`). */
export function SettingRow({ checked, onChange, label }: SettingRowProps) {
    return (
        <button
            type="button"
            aria-pressed={checked}
            onClick={() => onChange(!checked)}
            className={cn(
                MENU_ROW_CLASS,
                checked ? 'text-secondary-100' : 'text-secondary-400'
            )}
        >
            <CheckBox state={checked} />
            <span>{label}</span>
        </button>
    );
}
