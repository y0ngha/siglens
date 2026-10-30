import { SITE_NAME } from '@/shared/config/brand';
import { cn } from '@/shared/lib/cn';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import Image from 'next/image';
import type { ReactNode } from 'react';

interface AuthCardShellProps {
    title: string;
    subtitle?: string;
    children: ReactNode;
    footer?: ReactNode;
}

/** 로그인·회원가입·비밀번호 재설정이 공유하는 중앙 정렬 카드 셸. `<main>`을 직접 렌더한다. */
export function AuthCardShell({
    title,
    subtitle,
    children,
    footer,
}: AuthCardShellProps) {
    /*
     * 장식 레이어(글로우 blob·rgba 그리드·글래스모피즘 카드)를 두지 않는다. 로그인·회원가입·
     * 비밀번호 재설정 4개 페이지가 이 셸을 공유하므로 여기 한 곳이 사용자 진입 동선 전체의
     * 인상을 정한다.
     *
     * 깊이는 그림자가 아니라 표면값 차이(페이지 950 → 카드 800)와 헤어라인
     * 보더로 낸다. 라이트 테마에서 큰 확산 그림자는 즉시 지저분해 보이는데,
     * 이 방식은 두 테마에서 동일하게 동작한다.
     *
     * `min-h`는 헤더 높이를 빼는데, 하드코딩 3.5rem 대신 `--header-h` 토큰을
     * 쓴다 — 헤더 높이가 바뀌면 여기도 자동으로 따라간다.
     */
    return (
        <main className="flex min-h-[calc(100dvh-var(--header-h))] items-center justify-center bg-secondary-950 px-4 py-12">
            <section
                className={cn(
                    SURFACE_CARD,
                    'w-full max-w-md p-8 motion-safe:animate-[fade-up_220ms_ease-out]'
                )}
            >
                <header className="mb-8 flex flex-col items-start gap-5">
                    <div className="flex items-center gap-2">
                        {/*
                            icon24 대신 96×96 PNG를 쓴다 — 모서리가 날카로운 로고를 24→32로
                            키우면 1× DPI 화면에서 흐려 보인다. 인증 페이지는 LCP에 민감하지
                            않아 추가 바이트는 문제없다.
                        */}
                        <Image
                            src="/icon96.png"
                            alt=""
                            width={32}
                            height={32}
                            unoptimized
                            className="h-8 w-8"
                        />
                        <span
                            translate="no"
                            className="font-mono text-sm font-semibold tracking-[0.2em] text-secondary-100 uppercase"
                        >
                            {SITE_NAME}
                        </span>
                    </div>
                    <div>
                        <h1 className="text-2xl font-semibold text-secondary-50">
                            {title}
                        </h1>
                        {subtitle ? (
                            <p className="mt-1 text-sm text-secondary-400">
                                {subtitle}
                            </p>
                        ) : null}
                    </div>
                </header>
                {children}
                {footer ? (
                    <footer className="mt-6 text-sm text-secondary-400">
                        {footer}
                    </footer>
                ) : null}
            </section>
        </main>
    );
}
