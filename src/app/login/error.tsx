'use client';

import Link from 'next/link';

interface LoginErrorProps {
    reset: () => void;
}

export default function LoginError({ reset }: LoginErrorProps) {
    return (
        <main className="flex min-h-[calc(100dvh-3.5rem)] flex-col items-center justify-center gap-4 bg-slate-950 px-4 py-12 text-center">
            <h1 className="text-secondary-50 text-2xl font-semibold">
                로그인 페이지를 표시할 수 없어요
            </h1>
            <p className="text-secondary-400 text-sm">
                일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.
            </p>
            <div className="flex gap-3">
                <button
                    type="button"
                    onClick={reset}
                    className="inline-flex min-h-11 items-center rounded bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
                >
                    다시 시도
                </button>
                <Link
                    href="/"
                    className="text-secondary-200 hover:text-secondary-50 inline-flex min-h-11 items-center rounded px-4 text-sm font-medium focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
                >
                    홈으로
                </Link>
            </div>
        </main>
    );
}
