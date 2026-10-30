'use client';

import { type KeyboardEvent, type Ref } from 'react';
import { cn } from '@/shared/lib/cn';
import type { ExpirationTab } from '../../utils/expirationTabs';

const CHIP_BASE =
    'focus-visible:ring-primary-500 inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none';
// `font-semibold`는 색이 아닌 단서다 — 활성/비활성이 보더·채움·글자색 셋 다
// 파랑 대 중립이라는 **색상 차이**로만 갈려 있어, 색각 이상 사용자에게는 세 단서가
// 동시에 무력해진다. 굵기는 그와 독립적으로 읽힌다.
//
// 굵기가 바뀌면 텍스트 폭이 달라져 같은 행의 형제 칩이 밀릴 수 있다. 칩 안에는
// 12px `tab.label`과 10px `tab.sub`(font-mono) 두 텍스트 노드가 있고, `sub`에는
// 굵기 클래스가 없어 **둘 다** 500→600 상승을 상속한다. 그래서 버튼 박스 전체를
// 기준으로 실측했다: 선택을 0번에서 2번으로 옮겼을 때 형제 이동 **최대 1px**,
// 버튼 박스 폭 변화 **0**. 두 노드 다 글자가 작아 글리프 폭 차이가 flex gap에
// 흡수된다. 지각 임계 아래이므로 폭을 따로 예약하지 않는다.
const CHIP_ACTIVE =
    'border-primary-500 bg-primary-500/10 font-semibold text-primary-400';
// 비활성 칩은 채움이 투명해 보더가 유일한 경계다. 장식용 `secondary-600`은
// 라이트에서 약 1.4:1이라 칩 모양 자체가 안 보인다 — 컨트롤 경계용 토큰을 쓴다
// (WCAG 1.4.11, `globals.css`의 `--color-border-control` 주석 참고).
const CHIP_INACTIVE =
    'border-border-control text-secondary-300 hover:border-primary-500 hover:text-primary-400';

interface ExpirationChipProps {
    tab: ExpirationTab;
    active: boolean;
    buttonRef: Ref<HTMLButtonElement>;
    onSelect: () => void;
    onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
}

/** One `role="tab"` chip with roving tabindex. */
export function ExpirationChip({
    tab,
    active,
    buttonRef,
    onSelect,
    onKeyDown,
}: ExpirationChipProps) {
    return (
        <button
            ref={buttonRef}
            role="tab"
            type="button"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={onSelect}
            onKeyDown={onKeyDown}
            className={cn(CHIP_BASE, active ? CHIP_ACTIVE : CHIP_INACTIVE)}
        >
            <span>{tab.label}</span>
            {tab.sub !== undefined && (
                <span className="font-mono text-[10px] text-secondary-500">
                    {tab.sub}
                </span>
            )}
        </button>
    );
}
