'use client';

import { useTranslations } from 'next-intl';
import { useRef, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useTheme } from '@/shared/hooks/useTheme';
import { cn } from '@/shared/lib/cn';
import type { ThemePreference } from '@/shared/lib/theme';
import { CheckIcon } from '@/shared/ui/StrokeIcons';

/**
 * 테마 선택 라디오그룹 — 설정 따라가기 / 라이트 / 다크. 팝오버가 아니라 **인라인**이다:
 * 헤더의 설정 패널(비회원)과 아바타 메뉴(회원)가 자기 표면 안에 그대로 끼운다.
 *
 * **순환 버튼이 아니라 라디오인 이유**: 선택지가 셋이면 클릭으로 돌리는 방식은 "지금 무엇이
 * 선택돼 있는가"를 보여주지 못한다. 특히 `설정 따라가기`와 그 결과인 `다크`는 화면이 똑같아서
 * 아이콘 하나로는 둘을 구분할 방법이 없다.
 *
 * 리프 클라이언트 컴포넌트다 — 프로바이더도 전역 컨텍스트도 없다. 상태의 원천은
 * `<html data-theme>`(적용값)과 `localStorage`(선택)이며, 이 컴포넌트는 둘을 읽고 쓰기만 한다.
 *
 * 아이콘은 SVG 도형으로 그린다. Pretendard 서브셋은 닫힌 글리프셋이라 ☀︎/☾ 같은 문자를 쓰면
 * OS 폰트로 조용히 폴백돼 기기마다 다르게 보인다.
 */

interface ThemeOption {
    readonly value: ThemePreference;
    /** `shared.ui.themeOption` 키 — 표시는 렌더 쪽에서 `t()`로. */
    readonly labelKey: string;
}

/** `system`이 먼저다 — 기본값이자 대부분의 사용자가 머무는 자리. */
const OPTIONS: readonly ThemeOption[] = [
    { value: 'system', labelKey: 'system' },
    { value: 'light', labelKey: 'light' },
    { value: 'dark', labelKey: 'dark' },
];

/** 화살표 키 → 이동 방향. 목록 양 끝에서는 순환한다. */
const ARROW_DELTA: Record<string, number> = {
    ArrowDown: 1,
    ArrowRight: 1,
    ArrowUp: -1,
    ArrowLeft: -1,
};

interface ThemeIconProps {
    readonly value: ThemePreference;
}

function ThemeIcon({ value }: ThemeIconProps) {
    return (
        <svg
            viewBox="0 0 20 20"
            aria-hidden="true"
            className="size-4 shrink-0"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            {value === 'dark' && (
                <path d="M16 11.2A6.2 6.2 0 0 1 8.8 4a6.5 6.5 0 1 0 7.2 7.2Z" />
            )}
            {value === 'light' && (
                <>
                    <circle cx="10" cy="10" r="3.6" />
                    <path d="M10 2.2v1.6M10 16.2v1.6M17.8 10h-1.6M3.8 10H2.2M15.5 4.5l-1.1 1.1M5.6 14.4l-1.1 1.1M15.5 15.5l-1.1-1.1M5.6 5.6 4.5 4.5" />
                </>
            )}
            {value === 'system' && (
                /* 모니터 — "기기 설정"을 형태로 말한다. 해·달과 섞이지 않는
                   완전히 다른 실루엣이라 세 상태가 색 없이도 구분된다. */
                <>
                    <rect x="2.6" y="4" width="14.8" height="9.6" rx="1.4" />
                    <path d="M7 17h6M10 13.6V17" />
                </>
            )}
        </svg>
    );
}

interface ThemeRadioGroupProps {
    /** 그룹의 접근 이름을 대는 보이는 제목의 id(호스트 패널의 "테마" 제목). */
    readonly labelledBy: string;
}

export function ThemeRadioGroup({ labelledBy }: ThemeRadioGroupProps) {
    const tOption = useTranslations('shared.ui.themeOption');
    const { preference, setTheme } = useTheme();
    const groupRef = useRef<HTMLDivElement>(null);

    /*
     * WAI-ARIA APG의 라디오 그룹은 **단일 탭 스톱**이다. 선택된 항목만 `tabIndex=0`으로 두고
     * 이동은 화살표가 맡는다. APG 규약대로 화살표 이동은 포커스와 선택을 함께 옮긴다 — 언어와
     * 달리 테마는 페이지 이동이 없어 바로 적용해도 그룹이 사라지지 않는다.
     */
    const onKeyDown = (event: ReactKeyboardEvent, index: number) => {
        const delta = ARROW_DELTA[event.key];
        if (delta === undefined) return;
        event.preventDefault();
        const next = (index + delta + OPTIONS.length) % OPTIONS.length;
        const nextOption = OPTIONS[next];
        if (nextOption === undefined) return;
        groupRef.current
            ?.querySelectorAll<HTMLButtonElement>('[role="radio"]')
            [next]?.focus();
        setTheme(nextOption.value);
    };

    return (
        <div ref={groupRef} role="radiogroup" aria-labelledby={labelledBy}>
            {OPTIONS.map((option, index) => {
                const selected = option.value === preference;
                return (
                    <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        tabIndex={selected ? 0 : -1}
                        onKeyDown={event => onKeyDown(event, index)}
                        onClick={() => setTheme(option.value)}
                        className={cn(
                            'flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm transition-colors focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none',
                            selected
                                ? 'bg-secondary-700 text-secondary-100'
                                : 'text-secondary-300 hover:bg-secondary-700/60 hover:text-secondary-100'
                        )}
                    >
                        <ThemeIcon value={option.value} />
                        <span className="flex-1 whitespace-nowrap">
                            {tOption(option.labelKey)}
                        </span>
                        {/* 선택 표시를 색에만 싣지 않는다 — 체크 도형으로 한 번 더
                            말한다(WCAG 1.4.1). */}
                        {selected && <CheckIcon className="size-4 shrink-0" />}
                    </button>
                );
            })}
        </div>
    );
}
