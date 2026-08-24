'use client';

import { useTheme } from '@/shared/hooks/useTheme';

/**
 * 다크/라이트 전환 버튼.
 *
 * 리프 클라이언트 컴포넌트다 — 프로바이더도, 컨텍스트도 없다. 상태의 원천은
 * `<html data-theme>` 하나이며 이 버튼은 그것을 뒤집기만 한다. 헤더 전체를
 * 클라이언트 경계로 끌어올리지 않으므로 서버 렌더 범위가 줄지 않는다.
 *
 * 첫 렌더에서는 `useTheme`이 기본값(다크)을 반환한다. 인라인 스크립트가 이미
 * 화면을 올바르게 칠해둔 상태이고, 여기서 서버와 다른 라벨을 뱉으면 하이드레이션
 * 불일치가 나기 때문이다. 실제 라벨은 마운트 직후 한 박자 뒤에 맞춰진다 —
 * 그래서 `aria-label`에 현재 상태가 아니라 **동작**을 적는다("라이트 모드로
 * 전환"), 잠깐 어긋나도 의미가 틀리지 않도록.
 *
 * 아이콘 대신 도형 두 개를 CSS로 그린다. Pretendard 서브셋은 닫힌 글리프셋이라
 * ☀︎/☾ 같은 문자를 쓰면 OS 폰트로 조용히 폴백돼 기기마다 다르게 보인다.
 */
export function ThemeToggle() {
    const { theme, toggleTheme } = useTheme();
    const next = theme === 'dark' ? '라이트' : '다크';

    return (
        <button
            type="button"
            onClick={toggleTheme}
            aria-label={`${next} 모드로 전환`}
            title={`${next} 모드로 전환`}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-secondary-400 transition-colors hover:text-secondary-200 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
        >
            {/* 다크에서는 속이 빈 원(달), 라이트에서는 광선 있는 원(해).
                두 상태를 형태로 구분해 색상만으로 의미를 전달하지 않는다. */}
            <svg
                viewBox="0 0 20 20"
                aria-hidden="true"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
            >
                {theme === 'dark' ? (
                    <path d="M16 11.2A6.2 6.2 0 0 1 8.8 4a6.5 6.5 0 1 0 7.2 7.2Z" />
                ) : (
                    <>
                        <circle cx="10" cy="10" r="3.6" />
                        <path d="M10 2.2v1.6M10 16.2v1.6M17.8 10h-1.6M3.8 10H2.2M15.5 4.5l-1.1 1.1M5.6 14.4l-1.1 1.1M15.5 15.5l-1.1-1.1M5.6 5.6 4.5 4.5" />
                    </>
                )}
            </svg>
        </button>
    );
}
