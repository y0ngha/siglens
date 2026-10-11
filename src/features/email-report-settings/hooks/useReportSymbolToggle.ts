'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { excludeReportSymbolAction } from '@/entities/email-report/actions/excludeReportSymbolAction';
import { includeReportSymbolAction } from '@/entities/email-report/actions/includeReportSymbolAction';
import { REPORT_SYMBOLS_PREVIEW_ID } from '@/features/email-report-settings/lib/reportSymbolsPreviewIds';
import { useToast } from '@/shared/ui/ToastProvider';

/**
 * `exclude`: 리포트에 담긴 종목을 뺀다. `include`: 뺀 종목을 다시 넣는다. `clear`: 목록에서 이미
 * 지운 종목의 제외 기록을 지운다(저장소 동작은 `include`와 같다 — 행을 지운다).
 */
export type ReportSymbolToggleMode = 'exclude' | 'include' | 'clear';

interface UseReportSymbolToggleResult {
    pending: boolean;
    toggle: () => void;
}

/**
 * 리포트에서 종목을 빼거나 다시 넣는다. 성공하면 `router.refresh()`로 서버가 계산한 미리보기를
 * 다시 그리게 한다 — 상세/요약 배치는 서버의 `selectReportSymbols`만 알기 때문에 클라이언트가
 * 칩을 직접 옮기지 않는다. 트랜지션 안에서 새로고침을 기다리므로 `pending`은 화면이 갱신될
 * 때까지 유지된다. 성공하면 토스트로 알리고(`label`은 이름 또는 심볼) 미리보기 컨테이너로
 * 포커스를 옮긴다 — 눌렀던 칩이 사라져 포커스가 갈 곳을 잃기 때문이다. 실패는 액션이 만든
 * 문구(없으면 일반 문구)를 토스트로 알린다.
 */
export function useReportSymbolToggle(
    symbol: string,
    mode: ReportSymbolToggleMode,
    label: string
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
            const successMessage = (v0: string) => {
                if (mode === 'exclude')
                    return t('ReportSymbolChip.excludedToast', { v0 });
                if (mode === 'include')
                    return t('ReportSymbolChip.includedToast', { v0 });
                return t('ReportSymbolChip.clearedToast', { v0 });
            };
            try {
                const result = await action({ symbol });
                if (result.status === 'ok') {
                    router.refresh();
                    showToast({ message: successMessage(label) });
                    document.getElementById(REPORT_SYMBOLS_PREVIEW_ID)?.focus();
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
