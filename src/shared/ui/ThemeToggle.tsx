'use client';

import { useId, useRef } from 'react';
import { useTheme } from '@/shared/hooks/useTheme';
import { usePopoverToggle } from '@/shared/hooks/usePopoverToggle';
import { cn } from '@/shared/lib/cn';
import type { ThemePreference } from '@/shared/lib/theme';

/**
 * 테마 선택 메뉴 — 설정 따라가기 / 라이트 / 다크.
 *
 * **순환 버튼이 아니라 메뉴인 이유**: 선택지가 셋이 되면 클릭으로 돌리는 방식은
 * "지금 무엇이 선택돼 있는가"를 보여주지 못한다. 특히 `설정 따라가기`와 그 결과인
 * `다크`는 화면이 똑같아서, 아이콘 하나로는 둘을 구분할 방법이 없다. 라디오
 * 그룹으로 두면 현재 선택이 보이고 원하는 항목으로 바로 갈 수 있다.
 *
 * 리프 클라이언트 컴포넌트다 — 프로바이더도 전역 컨텍스트도 없다. 상태의 원천은
 * `<html data-theme>`(적용값)과 `localStorage`(선택)이며, 이 컴포넌트는 둘을
 * 읽고 쓰기만 한다. 헤더 전체를 클라이언트 경계로 끌어올리지 않는다.
 *
 * 포털을 쓰지 않는다. `PopoverSurface`가 포털을 쓰는 이유는 `SymbolLayoutHeader`가
 * `relative z-40`으로 스택 컨텍스트를 만들어 팝오버가 분석 시트에 덮이기 때문인데,
 * 이 버튼은 **사이트 헤더**(`sticky z-50`, 최상위)에 있어 그 함정이 없다.
 *
 * 아이콘은 CSS 도형으로 그린다. Pretendard 서브셋은 닫힌 글리프셋이라 ☀︎/☾ 같은
 * 문자를 쓰면 OS 폰트로 조용히 폴백돼 기기마다 다르게 보인다.
 */

interface ThemeOption {
    readonly value: ThemePreference;
    readonly label: string;
}

/** `system`이 먼저다 — 기본값이자 대부분의 사용자가 머무는 자리. */
const OPTIONS: readonly ThemeOption[] = [
    { value: 'system', label: '설정 따라가기' },
    { value: 'light', label: '라이트' },
    { value: 'dark', label: '다크' },
];

function ThemeIcon({ value }: { value: ThemePreference }) {
    return (
        <svg
            viewBox="0 0 20 20"
            aria-hidden="true"
            className="h-5 w-5 shrink-0"
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

export function ThemeToggle() {
    const { preference, setTheme } = useTheme();
    const containerRef = useRef<HTMLDivElement>(null);
    const { isOpen, close, toggle } = usePopoverToggle(containerRef);
    const menuId = useId();

    const current = OPTIONS.find(o => o.value === preference) ?? OPTIONS[0]!;

    return (
        <div ref={containerRef} className="relative shrink-0">
            <button
                type="button"
                onClick={toggle}
                aria-haspopup="true"
                aria-expanded={isOpen}
                aria-controls={isOpen ? menuId : undefined}
                /* 라벨에 **현재 선택**을 적는다. 예전 2단 토글은 동작("라이트 모드로
                   전환")을 적었는데, 그건 클릭 결과가 하나로 정해져 있을 때만
                   맞는 문구다. 메뉴는 결과가 셋이므로 지금 상태를 말해야 한다. */
                aria-label={`테마: ${current.label}`}
                title={`테마: ${current.label}`}
                className="flex h-11 w-11 items-center justify-center rounded-lg text-secondary-400 transition-colors hover:text-secondary-200 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
            >
                <ThemeIcon value={current.value} />
            </button>

            {isOpen && (
                <div
                    id={menuId}
                    role="radiogroup"
                    aria-label="테마 선택"
                    className="absolute right-0 z-10 mt-1 w-max min-w-44 rounded-lg border border-secondary-700 bg-secondary-800 p-1 shadow-lg"
                >
                    {OPTIONS.map(option => {
                        const selected = option.value === preference;
                        return (
                            <button
                                key={option.value}
                                type="button"
                                role="radio"
                                aria-checked={selected}
                                onClick={() => {
                                    setTheme(option.value);
                                    close();
                                }}
                                className={cn(
                                    'flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm transition-colors focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none',
                                    selected
                                        ? 'bg-secondary-700 text-secondary-100'
                                        : 'text-secondary-300 hover:bg-secondary-700/60 hover:text-secondary-100'
                                )}
                            >
                                <ThemeIcon value={option.value} />
                                <span className="flex-1 whitespace-nowrap">
                                    {option.label}
                                </span>
                                {/* 선택 표시를 색에만 싣지 않는다 — 체크 도형으로
                                    한 번 더 말한다(WCAG 1.4.1). */}
                                {selected && (
                                    <svg
                                        viewBox="0 0 16 16"
                                        aria-hidden="true"
                                        className="h-4 w-4 shrink-0"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    >
                                        <path d="m3.5 8.5 3 3 6-7" />
                                    </svg>
                                )}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
