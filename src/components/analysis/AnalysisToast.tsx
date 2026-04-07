'use client';

import { useEffect, useState } from 'react';
import type { CooldownNotice } from '@/components/symbol-page/hooks/useAnalysis';

/**
 * AnalysisPanel 내부에서만 표시되는 경량 토스트.
 * 글로벌 토스트 인프라를 새로 들이지 않고, 패널 우상단에 absolute로 떠올라
 * 일정 시간 후 자연스럽게 사라진다. 화면 전체를 가리지 않는다.
 *
 * 동일 nonce는 중복 표시되지 않으며, nonce가 갱신될 때마다 다시 보인다.
 */

const TOAST_VISIBLE_MS = 3500;

interface AnalysisToastProps {
    notice: CooldownNotice | null;
}

function formatRemaining(ms: number): string {
    const totalSec = Math.ceil(ms / 1000);
    const minutes = Math.floor(totalSec / 60);
    const seconds = totalSec % 60;
    if (minutes <= 0) return `${seconds}초`;
    return `${minutes}분 ${seconds.toString().padStart(2, '0')}초`;
}

export function AnalysisToast({ notice }: AnalysisToastProps) {
    const [visibleNonce, setVisibleNonce] = useState<number | null>(null);

    useEffect(() => {
        if (notice === null) return;
        setVisibleNonce(notice.nonce);
        const timeoutId = window.setTimeout(() => {
            setVisibleNonce(current =>
                current === notice.nonce ? null : current
            );
        }, TOAST_VISIBLE_MS);
        return () => {
            window.clearTimeout(timeoutId);
        };
    }, [notice]);

    if (notice === null || visibleNonce !== notice.nonce) return null;

    return (
        <div
            role="status"
            aria-live="polite"
            className="border-ui-warning/30 bg-secondary-900/95 text-secondary-100 pointer-events-none absolute top-3 right-3 z-10 flex max-w-[90%] items-start gap-2 rounded-md border px-3 py-2 text-xs shadow-lg backdrop-blur-sm"
        >
            <span className="bg-ui-warning mt-1 inline-block h-1.5 w-1.5 shrink-0 animate-pulse rounded-full" />
            <span className="leading-snug">
                재분석은 5분에 한 번만 가능해요.
                <br />
                <span className="text-secondary-400">
                    약 {formatRemaining(notice.remainingMs)} 뒤에 다시 시도해
                    주세요.
                </span>
            </span>
        </div>
    );
}
