'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { excludeReportSymbolAction } from '@/entities/email-report/actions/excludeReportSymbolAction';
import { includeReportSymbolAction } from '@/entities/email-report/actions/includeReportSymbolAction';
import { useToast } from '@/shared/ui/ToastProvider';

export type ReportSymbolToggleMode = 'exclude' | 'include';

interface UseReportSymbolToggleResult {
    pending: boolean;
    toggle: () => void;
}

/**
 * 리포트에서 종목을 빼거나 다시 넣는다. 성공하면 `router.refresh()`로 서버가 계산한 미리보기를
 * 다시 그리게 한다 — 상세/요약 배치는 서버의 `selectReportSymbols`만 알기 때문에 클라이언트가
 * 칩을 직접 옮기지 않는다. 트랜지션 안에서 새로고침을 기다리므로 `pending`은 화면이 갱신될
 * 때까지 유지된다. 실패는 액션이 만든 문구(없으면 일반 문구)를 토스트로 알린다.
 */
export function useReportSymbolToggle(
    symbol: string,
    mode: ReportSymbolToggleMode
): UseReportSymbolToggleResult {
    const t = useTranslations('features.email-report-settings');
    const router = useRouter();
    const { showToast } = useToast();
    const [pending, startTransition] = useTransition();

    const toggle = () => {
        if (pending) return;
        startTransition(async () => {
            const action =
                mode === 'exclude'
                    ? excludeReportSymbolAction
                    : includeReportSymbolAction;
            try {
                const result = await action({ symbol });
                if (result.status === 'ok') {
                    router.refresh();
                    return;
                }
                showToast({ message: result.message });
            } catch {
                // 네트워크 단절 등으로 액션 자체가 던지면 일반 문구로 알린다.
                showToast({ message: t('ReportSymbolChip.failed') });
            }
        });
    };

    return { pending, toggle };
}
