import { SITE_NAME } from '@/shared/lib/seo';
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

export function AuthCardShell({
    title,
    subtitle,
    children,
    footer,
}: AuthCardShellProps) {
    /*
     * 2026-08 리디자인: 장식 레이어를 걷어냈다. 이전에는 좌상단 글로우
     * blob(`blur-3xl`)과 하드코딩 rgba 그리드 오버레이, 글래스모피즘
     * 카드(`backdrop-blur-xl` + 30px 확산 그림자)가 겹쳐 있었는데, 세 요소
     * 모두 2024~25년 AI 생성 랜딩 페이지의 대표 시그니처다. 로그인·회원가입·
     * 비밀번호 재설정 4개 페이지가 이 셸을 공유하므로 여기 한 곳만 정리하면
     * 사용자 진입 동선 전체의 인상이 바뀐다.
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
                            Use the 96×96 PNG (not icon24) because a 24→32 upscale
                            on a logo with sharp edges produces visible blurriness
                            on 1× DPI displays; the auth page is not LCP-sensitive
                            so the extra bytes are fine.
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
