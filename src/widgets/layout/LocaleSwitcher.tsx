'use client';

import { useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/shared/i18n/navigation';
import {
    LOCALES,
    LOCALE_NATIVE_LABEL,
    type Locale,
} from '@/shared/i18n/locales';
import { cn } from '@/shared/lib/cn';

interface LocaleSwitcherProps {
    readonly className?: string;
    /** 드로어가 닫혀 있을 때 포커스 순서에서 빼기 위한 값(모바일 메뉴가 넘긴다). */
    readonly tabIndex?: number;
}

/**
 * 언어 전환기 — 데스크톱 헤더와 모바일 드로어가 **같은 컴포넌트를 쓴다**.
 *
 * 팝오버 대신 네이티브 `<select>`인 것은 의도다.
 *  - iOS/Android가 자체 휠·리스트 UI를 띄운다. 좁은 화면에서 커스텀 팝오버보다
 *    조작이 쉽고, 우리 쪽 포털·포커스 트랩 코드가 하나도 늘지 않는다.
 *    (이 드로어의 포커스 트랩은 Fragment↔Portal 스왑에 취약한 이력이 있어
 *    새 포털을 추가하지 않는 편이 안전하다.)
 *  - 키보드 조작·스크린리더 지원이 공짜다.
 *
 * 언어 이름은 **번역하지 않는다** — 영어권 사용자는 "영어"를 읽지 못한다.
 * 각 옵션에 `lang` 속성을 달아 스크린리더가 해당 언어 음성으로 읽게 한다.
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
 */
function GlobeGlyph() {
    return (
        <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="pointer-events-none absolute left-1.5 h-4 w-4 text-secondary-400"
        >
            <circle cx="12" cy="12" r="10" />
            <path d="M2 12h20" />
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
    );
}

export function LocaleSwitcher({ className, tabIndex }: LocaleSwitcherProps) {
    const t = useTranslations('widgets.layout');
    const locale = useLocale() as Locale;
    const pathname = usePathname();
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    return (
        <label
            className={cn(
                'relative inline-flex min-h-11 items-center',
                className
            )}
        >
            <span className="sr-only">{t('localeSwitcher.label')}</span>
            {/* `<label>` 안이라 아이콘을 눌러도 select가 열린다. 자기 자신은
                pointer-events를 받지 않아 클릭을 삼키지 않는다. */}
            <GlobeGlyph />
            <select
                value={locale}
                disabled={isPending}
                tabIndex={tabIndex}
                onChange={event => {
                    const next = event.target.value as Locale;
                    if (next === locale) return;
                    // `useSearchParams()`를 쓰지 않는다. 이 컴포넌트는 헤더에
                    // 있어 Suspense 경계 밖이고, 그 훅은 CSR bailout을 일으켜
                    // **정적 생성 자체를 깬다**(실측: `/ko/account`,
                    // `/ko/account/delete` 프리렌더 실패). 여기서 필요한 건
                    // 반응성이 아니라 클릭 시점의 값 하나뿐이다.
                    const { search: query, hash } = window.location;
                    startTransition(() => {
                        router.replace(`${pathname}${query}${hash}`, {
                            locale: next,
                        });
                    });
                }}
                className="min-h-11 cursor-pointer appearance-none rounded bg-transparent py-2 pr-6 pl-7 text-sm text-secondary-300 transition-colors hover:text-secondary-100 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none disabled:opacity-60"
            >
                {LOCALES.map(option => (
                    <option
                        key={option}
                        value={option}
                        lang={option}
                        // 옵션은 네이티브 팝업에서 OS 배경 위에 그려진다.
                        // 헤더의 어두운 배경색을 상속하면 일부 브라우저에서
                        // 글자가 배경과 같은 색이 되어 읽히지 않는다.
                        className="bg-secondary-900 text-secondary-100"
                    >
                        {LOCALE_NATIVE_LABEL[option]}
                    </option>
                ))}
            </select>
            {/* caret — select의 기본 화살표를 지웠으므로 직접 그린다. */}
            <span
                aria-hidden="true"
                className="pointer-events-none absolute right-1 text-xs text-secondary-500"
            >
                ▾
            </span>
        </label>
    );
}
