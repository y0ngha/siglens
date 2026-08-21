'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import type { CooldownNotice } from './model/types';
import { MS_PER_SECOND, SECONDS_PER_MINUTE } from '@/shared/config/time';

/**
 * AnalysisPanel 내부에서만 표시되는 경량 토스트.
 * 글로벌 토스트 인프라를 새로 들이지 않고, 패널 우상단에 absolute로 떠올라
 * 일정 시간 후 자연스럽게 사라진다. 화면 전체를 가리지 않는다.
 *
 * 부모에서 key={notice?.nonce}로 마운트되므로, nonce가 바뀔 때마다 새로 마운트된다.
 * 동일 nonce는 중복 표시되지 않으며, nonce가 갱신될 때마다 다시 보인다.
 */

const TOAST_VISIBLE_MS = 3500;

interface AnalysisToastProps {
    notice: CooldownNotice | null;
}

/**
 * 남은 시간을 `widgets.analysis.duration` 템플릿으로 만든다. 번역자를 인자로
 * 받는 이유는 이 파일의 다른 헬퍼들과 같다 — 모듈 스코프 함수라 훅을 못 쓴다.
 */
function formatRemaining(
    ms: number,
    t: (key: string, values?: Record<string, string | number>) => string
): string {
    const totalSec = Math.ceil(ms / MS_PER_SECOND);
    const minutes = Math.floor(totalSec / SECONDS_PER_MINUTE);
    const seconds = totalSec % SECONDS_PER_MINUTE;
    if (minutes <= 0) return t('seconds', { v0: seconds });
    return t('minutesSeconds', {
        v0: minutes,
        v1: seconds.toString().padStart(2, '0'),
    });
}

export function AnalysisToast({ notice }: AnalysisToastProps) {
    const t = useTranslations('widgets.analysis');
    const tDuration = useTranslations('widgets.analysis.duration');
    const [isVisible, setIsVisible] = useState(notice !== null);

    // TOAST_VISIBLE_MS 후 토스트를 숨긴다.
    useEffect(() => {
        if (!isVisible) return;
        const timeoutId = window.setTimeout(
            () => setIsVisible(false),
            TOAST_VISIBLE_MS
        );
        return () => {
            window.clearTimeout(timeoutId);
        };
    }, [isVisible]);

    if (!isVisible || notice === null) return null;

    return (
        <div
            role="status"
            aria-live="polite"
            className="pointer-events-none absolute top-3 right-3 z-10 flex max-w-[90%] items-start gap-2 rounded-md border border-ui-warning/30 bg-secondary-900/95 px-3 py-2 text-xs text-secondary-100 shadow-lg backdrop-blur-sm"
        >
            <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-ui-warning" />
            <span className="leading-snug">
                {t('AnalysisToast.93531d')}
                <br />
                <span className="text-secondary-400">
                    {t('AnalysisToast.b87ea9', {
                        v0: formatRemaining(notice.remainingMs, tDuration),
                    })}
                </span>
            </span>
        </div>
    );
}
