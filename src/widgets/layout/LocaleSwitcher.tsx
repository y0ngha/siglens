'use client';

import { useId, useRef, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/shared/i18n/navigation';
import {
    LOCALES,
    LOCALE_NATIVE_LABEL,
    type Locale,
} from '@/shared/i18n/locales';
import { useEscapeKey } from '@/shared/hooks/useEscapeKey';
import { usePopoverToggle } from '@/shared/hooks/usePopoverToggle';
import { cn } from '@/shared/lib/cn';

interface LocaleSwitcherProps {
    readonly className?: string;
    /** 드로어가 닫혀 있을 때 포커스 순서에서 빼기 위한 값(모바일 메뉴가 넘긴다). */
    readonly tabIndex?: number;
    /**
     * 현재 언어를 아이콘 옆에 글자로도 보인다.
     *
     * 기본값(`false`)은 **좁은 화면에서만** 숨긴다(`hidden sm:inline`) — 모바일
     * 헤더 한 줄에 로고·검색·언어·테마·계정·햄버거가 이미 서 있어 360px에서
     * 라벨까지 넣으면 넘친다. 드로어처럼 가로가 남는 자리는 `true`로 강제한다.
     */
    readonly showLabel?: boolean;
    /**
     * 팝오버를 트리거의 어느 쪽에 붙일지.
     *
     * 기본값 `end`(오른쪽 정렬)는 헤더 오른쪽 끝에 선 트리거용이다. 드로어처럼
     * 트리거가 **왼쪽**에 있는 자리에서 `end`를 쓰면 패널이 왼쪽으로 뻗어
     * 화면 밖으로 나간다.
     */
    readonly align?: 'start' | 'end';
}

/**
 * 언어 전환기 — 데스크톱 헤더·모바일 헤더·모바일 드로어가 **같은 컴포넌트를 쓴다**.
 *
 * **네이티브 `<select>`에서 팝오버 라디오그룹으로 바꿨다.** `<select>`는 OS가
 * 자체 UI를 띄워 조작·접근성이 공짜였지만, 바로 옆 `ThemeToggle`이 팝오버라
 * 같은 줄에 성격이 다른 두 컨트롤이 서 있었다 — 하나는 눌렀을 때 OS 시트가
 * 뜨고 하나는 앱 안에서 메뉴가 열렸다. 두 개가 같은 자리에서 같은 종류의
 * 선택(설정)을 하므로 상호작용이 같아야 한다.
 *
 * 팝오버로 오면서 잃은 것을 손으로 채운다: 바깥 클릭·Esc 닫기
 * (`usePopoverToggle`·`useEscapeKey`), 단일 탭 스톱 + 화살표 이동
 * (WAI-ARIA APG 라디오 그룹), 선택 표시를 색이 아니라 체크 도형으로도 표현
 * (WCAG 1.4.1). 전부 `ThemeToggle`과 같은 구현이다.
 *
 * 포털을 쓰지 않는다 — 사이트 헤더는 `sticky z-50`(최상위)이라 팝오버가 덮일
 * 스택 컨텍스트 함정이 없다(`ThemeToggle` JSDoc과 같은 근거).
 *
 * 언어 이름은 **번역하지 않는다** — 영어권 사용자는 "영어"를 읽지 못한다.
 * 각 항목에 `lang` 속성을 달아 스크린리더가 해당 언어 음성으로 읽게 한다.
 *
 * 전환은 `replace`다. `push`면 언어를 두 번 바꾼 사용자가 뒤로가기를 눌렀을 때
 * 이전 언어 페이지로 돌아가 "뒤로가기가 언어를 되돌린다"는 혼란이 생긴다.
 *
 * **쿼리스트링·해시를 보존한다.** next-intl의 `usePathname()`은 경로만 돌려주므로
 * 그대로 `router.replace`에 넘기면 검색 파라미터가 사라진다. 이건 편의 문제가
 * 아니라 데이터 손실이다 — `/reset-password?token=…`에서 언어를 바꾸면 토큰이
 * 날아가 "링크가 유효하지 않다"는 화면을 보게 되고(메일함으로 돌아가야 한다),
 * `/signup/oauth/consent?token=…`에서는 진행 중이던 소셜 가입이 통째로 취소된다.
 * `?tf=`·`?next=`·`?sector=` 같은 화면 상태도 같은 이유로 유지한다.
 *
 * **쿠키를 쓰지 않는다.** 로케일의 단일 소스는 URL이다. 쿠키로 기억해 두면
 * 루트 진입 시 리다이렉트하고 싶어지는데, 그건 `localeDetection: false`로 막아 둔
 * 바로 그 동작(크롤러 이탈 + CDN 캐시 오염)이다.
 */

/**
 * 언어 전환의 관용 아이콘 — 지구본.
 *
 * **인라인 SVG다.** `widgets/layout` 배럴은 헤더를 통해 33개 전 라우트의
 * first-load 청크에 들어 있고 `package.json`에 `sideEffects`가 없어 미사용
 * re-export가 제거되지 않는다 — 아이콘 패키지를 들이면 그 무게가 그대로
 * 전역으로 퍼진다. `SearchTriggerButton`·`HeaderMobileMenu`도 같은 이유로
 * 인라인 SVG를 쓴다.
 *
 * 구글 번역의 `文A` 마크를 베끼지 않는다 — 특정 서비스의 식별 표지다.
 * 지구본은 언어 선택의 일반 관용구다.
 *
 * 획 두께·크기는 `ThemeToggle`의 아이콘과 맞춘다(`h-5 w-5`, `strokeWidth 1.6`) —
 * 두 트리거가 헤더에서 나란히 서므로 굵기가 다르면 한쪽이 더 진해 보인다.
 */
function GlobeIcon() {
    return (
        <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5 shrink-0"
        >
            <circle cx="12" cy="12" r="9" />
            <path d="M3 12h18" />
            <path d="M12 3a14 14 0 0 1 3.6 9A14 14 0 0 1 12 21a14 14 0 0 1-3.6-9A14 14 0 0 1 12 3z" />
        </svg>
    );
}

export function LocaleSwitcher({
    className,
    tabIndex,
    showLabel = false,
    align = 'end',
}: LocaleSwitcherProps) {
    const t = useTranslations('widgets.layout');
    const locale = useLocale() as Locale;
    const pathname = usePathname();
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const containerRef = useRef<HTMLDivElement>(null);
    const groupRef = useRef<HTMLDivElement>(null);
    const { isOpen, close, toggle } = usePopoverToggle(containerRef);
    useEscapeKey(close, isOpen);
    const menuId = useId();

    const select = (next: Locale) => {
        if (next === locale) return;
        // `useSearchParams()`를 쓰지 않는다. 이 컴포넌트는 헤더에 있어 Suspense
        // 경계 밖이고, 그 훅은 CSR bailout을 일으켜 **정적 생성 자체를 깬다**
        // (실측: `/ko/account`, `/ko/account/delete` 프리렌더 실패). 여기서
        // 필요한 건 반응성이 아니라 클릭 시점의 값 하나뿐이다.
        const { search: query, hash } = window.location;
        startTransition(() => {
            router.replace(`${pathname}${query}${hash}`, { locale: next });
        });
    };

    /*
     * WAI-ARIA APG의 라디오 그룹은 **단일 탭 스톱**이다. 네 항목을 각각 탭
     * 스톱으로 두면 Tab만으로 그룹을 빠져나가려는 사용자가 네 번을 눌러야 한다.
     *
     * `ThemeToggle`과 **다른 점**: 화살표 이동이 선택까지 옮기지 않는다. 테마는
     * 즉시 되돌릴 수 있는 화면 변경이지만, 언어는 라우터 이동이라 화살표를
     * 한 번 누르는 순간 페이지가 통째로 바뀌고 메뉴도 사라진다. 여기서는
     * 포커스만 옮기고 선택은 Enter/Space(버튼 기본 동작)가 맡는다.
     */
    const moveFocus = (from: number, delta: number) => {
        const next = (from + delta + LOCALES.length) % LOCALES.length;
        const buttons =
            groupRef.current?.querySelectorAll<HTMLButtonElement>(
                '[role="radio"]'
            );
        buttons?.[next]?.focus();
    };

    return (
        <div
            ref={containerRef}
            /* **`inline-flex`여야 한다.** 블록이면 드로어처럼 flex 행이 아닌
               부모에서 폭을 통째로 먹고, 그러면 아래 팝오버의 `right-0`이
               트리거가 아니라 **부모의 오른쪽 끝**을 기준으로 붙는다 —
               모바일 드로어에서 드롭다운이 엉뚱한 자리에 뜨던 원인이다. */
            className={cn('relative inline-flex shrink-0', className)}
        >
            <button
                type="button"
                onClick={toggle}
                disabled={isPending}
                tabIndex={tabIndex}
                aria-haspopup="true"
                aria-expanded={isOpen}
                aria-controls={isOpen ? menuId : undefined}
                /* 라벨에 **현재 선택**을 적는다 — 메뉴는 결과가 넷이므로
                   동작이 아니라 지금 상태를 말해야 한다(`ThemeToggle`과 같은 근거). */
                aria-label={t('localeSwitcher.current', {
                    v0: LOCALE_NATIVE_LABEL[locale],
                })}
                title={t('localeSwitcher.current', {
                    v0: LOCALE_NATIVE_LABEL[locale],
                })}
                className={cn(
                    'flex h-11 items-center justify-center gap-1.5 rounded-lg text-secondary-400 transition-colors hover:text-secondary-200 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none disabled:text-secondary-500',
                    /*
                     * 라벨이 **보일 때는 정사각 고정을 푼다.** 모바일 헤더는
                     * 아이콘만 남으므로 44px 정사각으로 형제(검색·햄버거)와
                     * 폭을 맞추지만, 드로어처럼 라벨을 강제한 자리에서 그 폭을
                     * 유지하면 아이콘+글자가 44px 안에 갇혀 왼쪽 벽에 달라붙는다.
                     */
                    showLabel ? 'px-2' : 'w-11 px-0 sm:w-auto sm:px-2'
                )}
            >
                <GlobeIcon />
                <span
                    className={cn(
                        'text-sm',
                        showLabel ? 'inline' : 'hidden sm:inline'
                    )}
                >
                    {LOCALE_NATIVE_LABEL[locale]}
                </span>
            </button>

            {isOpen && (
                <div
                    ref={groupRef}
                    id={menuId}
                    role="radiogroup"
                    aria-label={t('localeSwitcher.label')}
                    className={cn(
                        'absolute top-full z-10 mt-1 w-max min-w-44 rounded-lg border border-secondary-700 bg-secondary-800 p-1 shadow-lg',
                        align === 'start' ? 'left-0' : 'right-0'
                    )}
                >
                    {LOCALES.map((option, index) => {
                        const selected = option === locale;
                        return (
                            <button
                                key={option}
                                type="button"
                                role="radio"
                                lang={option}
                                aria-checked={selected}
                                tabIndex={selected ? 0 : -1}
                                onKeyDown={e => {
                                    if (
                                        e.key === 'ArrowDown' ||
                                        e.key === 'ArrowRight'
                                    ) {
                                        e.preventDefault();
                                        moveFocus(index, 1);
                                    } else if (
                                        e.key === 'ArrowUp' ||
                                        e.key === 'ArrowLeft'
                                    ) {
                                        e.preventDefault();
                                        moveFocus(index, -1);
                                    }
                                }}
                                onClick={() => {
                                    select(option);
                                    close();
                                }}
                                className={cn(
                                    'flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm transition-colors focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none',
                                    selected
                                        ? 'bg-secondary-700 text-secondary-100'
                                        : 'text-secondary-300 hover:bg-secondary-700/60 hover:text-secondary-100'
                                )}
                            >
                                <span className="flex-1 whitespace-nowrap">
                                    {LOCALE_NATIVE_LABEL[option]}
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
