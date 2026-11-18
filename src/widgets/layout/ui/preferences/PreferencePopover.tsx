'use client';

import { useId, type ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';
import { SURFACE_FLOATING } from '@/shared/lib/surfaceStyles';
import { usePopoverDisclosure } from '../../hooks/usePopoverDisclosure';

interface PreferencePopoverProps {
    /** 트리거 안의 아이콘(文A·◐). 44px 정사각 버튼에 라벨 없이 선다. */
    readonly icon: ReactNode;
    /**
     * 트리거의 접근 이름 — **현재 선택**을 적는다("언어: 한국어"). 결과가 여럿이라 동작이 아니라
     * 지금 상태를 말해야 한다. 보이는 글자가 없어 `title`로도 보인다.
     */
    readonly label: string;
    /** 패널 맨 위의 보이는 제목("언어"). 안의 라디오그룹이 이 제목으로 이름을 얻는다. */
    readonly heading: string;
    /** 패널 본문. `close`는 고른 뒤 패널을 닫아야 하는 항목(언어 — 페이지가 바뀐다)이 부른다. */
    readonly children: (props: {
        readonly headingId: string;
        readonly close: () => void;
    }) => ReactNode;
}

/**
 * 비회원 헤더의 설정 팝오버 셸 — 아이콘 버튼 하나 + 제목이 달린 패널. 언어(文A)와 테마(◐)가 각각
 * 한 벌씩 쓴다(`HeaderPreferencesMenu`).
 *
 * Disclosure 패턴이다 — 명령 메뉴가 아니라 라디오그룹을 담은 영역이라 `aria-haspopup` 없이
 * `aria-expanded`만 단다. 바깥 클릭·Escape 닫기와 Escape 시 포커스 복원은 `usePopoverDisclosure`가
 * 맡는다. 포털을 쓰지 않는다: 사이트 헤더는 `sticky z-50`(최상위)이라 덮일 스택 컨텍스트 함정이
 * 없다. 패널은 트리거 오른쪽 끝에 맞춰 왼쪽으로 펼친다 — 헤더 오른쪽 끝 근처라 반대로 펼치면
 * 폰 폭에서 화면 밖으로 나간다.
 */
export function PreferencePopover({
    icon,
    label,
    heading,
    children,
}: PreferencePopoverProps) {
    const { containerRef, triggerRef, isOpen, close, toggle } =
        usePopoverDisclosure();
    const panelId = useId();
    const headingId = useId();

    return (
        <div ref={containerRef} className="relative inline-flex shrink-0">
            <button
                ref={triggerRef}
                type="button"
                onClick={toggle}
                aria-expanded={isOpen}
                aria-controls={isOpen ? panelId : undefined}
                aria-label={label}
                title={label}
                className="flex size-11 items-center justify-center rounded-lg text-secondary-400 transition-colors hover:text-secondary-200 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
            >
                {icon}
            </button>
            {isOpen && (
                <div
                    id={panelId}
                    className={cn(
                        SURFACE_FLOATING,
                        'absolute top-full right-0 z-10 mt-1 w-52 p-1 shadow-lg'
                    )}
                >
                    <p
                        id={headingId}
                        className="px-3 pt-2 pb-1 text-xs font-medium text-secondary-400"
                    >
                        {heading}
                    </p>
                    {children({ headingId, close })}
                </div>
            )}
        </div>
    );
}
