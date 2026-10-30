'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { usePortfolioHoldings } from '@/entities/portfolio/hooks/usePortfolioHoldings';
import type {
    PortfolioHoldingView,
    RawHoldingInput,
    SavePortfolioResult,
} from '@/entities/portfolio/model';
import {
    closeIfCurrent,
    resolveHoldingsListView,
    type HoldingsListView,
} from '../lib/portfolioSectionState';
import { resolveOrNull } from '../lib/resolveOrNull';

/** 삭제가 실패한 행과 그 행 아래에 띄울 문구. */
export interface HoldingDeleteError {
    symbol: string;
    message: string;
}

/** `usePortfolioSection`의 입력. `PortfolioSection`의 props를 그대로 받는다. */
export interface UsePortfolioSectionOptions {
    /** 저장·삭제 성공 직후 호출된다(`/portfolio`의 서버 위치 카드 새로고침). */
    onHoldingsChange?: () => void;
}

/** `PortfolioSection` 렌더에 필요한 목록 상태와 행·추가 폼 핸들러. */
export interface UsePortfolioSectionResult {
    holdings: PortfolioHoldingView[];
    listView: HoldingsListView;
    refetch: () => void;
    /** 삭제 성공 뒤 포커스를 받는 섹션 제목. */
    headingRef: React.RefObject<HTMLHeadingElement | null>;
    /** polite 상태 영역에 읽힐 저장·삭제 성공 문구. */
    statusMessage: string | null;
    editingSymbol: string | null;
    confirmingDeleteSymbol: string | null;
    /** 삭제 요청이 진행 중인 행의 심볼. 다른 행의 버튼은 이 요청과 무관하게 살아 있다. */
    deletingSymbol: string | null;
    deleteError: HoldingDeleteError | null;
    startEdit: (symbol: string) => void;
    cancelEdit: (symbol: string) => void;
    saveEdit: (
        symbol: string,
        input: RawHoldingInput
    ) => Promise<SavePortfolioResult>;
    requestDelete: (symbol: string) => void;
    cancelDelete: (symbol: string) => void;
    confirmDelete: (symbol: string) => Promise<void>;
    addHolding: (input: RawHoldingInput) => Promise<SavePortfolioResult>;
}

/**
 * 회원 보유종목 관리 섹션의 상태 기계: 인라인 편집 한 행, 인라인 삭제 확인 한 행, 행별 삭제 오류,
 * 성공 알림, 삭제 성공 뒤 제목 포커스.
 *
 * 저장·삭제는 수백 ms가 걸려 그사이 사용자가 다른 행을 열 수 있다. 그래서 응답 뒤의 상태 정리는
 * 응답이 속한 행이 아직 열려 있을 때만 하고, 삭제 진행 중 표시도 그 행에만 둔다.
 */
export function usePortfolioSection({
    onHoldingsChange,
}: UsePortfolioSectionOptions): UsePortfolioSectionResult {
    const [editingSymbol, setEditingSymbol] = useState<string | null>(null);
    const [confirmingDeleteSymbol, setConfirmingDeleteSymbol] = useState<
        string | null
    >(null);
    const [deleteError, setDeleteError] = useState<HoldingDeleteError | null>(
        null
    );
    const [statusMessage, setStatusMessage] = useState<string | null>(null);
    // 삭제 성공마다 올린다. 제목 포커스를 handler에서 바로 부르지 않고 effect로 돌리는 이유:
    // 성공하면 그 행이 삭제 확인을 벗어나면서 자기 effect로 "삭제" 버튼에 포커스를 돌려놓는다.
    // 같은 커밋에서 자식 effect가 부모 effect보다 먼저 돌므로, 부모 effect에서 옮겨야 곧 사라질
    // 버튼이 아니라 제목에 포커스가 남는다.
    const [deleteSuccessTick, setDeleteSuccessTick] = useState(0);

    const headingRef = useRef<HTMLHeadingElement>(null);
    const handledDeleteTickRef = useRef(0);

    const tToast = useTranslations('features.portfolio-management.toast');
    const t = useTranslations('features.portfolio-management');
    const { holdings, isHydrated, isLoading, isError, refetch, save, remove } =
        usePortfolioHoldings();
    const { mutateAsync: saveHolding } = save;
    const { mutateAsync: removeHolding } = remove;

    const startEdit = useCallback((symbol: string) => {
        setConfirmingDeleteSymbol(null);
        setEditingSymbol(symbol);
    }, []);

    const cancelEdit = useCallback((symbol: string) => {
        setEditingSymbol(closeIfCurrent(symbol));
    }, []);

    const requestDelete = useCallback((symbol: string) => {
        setEditingSymbol(null);
        setDeleteError(null);
        setConfirmingDeleteSymbol(symbol);
    }, []);

    const cancelDelete = useCallback((symbol: string) => {
        setConfirmingDeleteSymbol(closeIfCurrent(symbol));
    }, []);

    const saveAndAnnounce = useCallback(
        async (input: RawHoldingInput): Promise<SavePortfolioResult> => {
            setStatusMessage(null);
            const result = await saveHolding(input);
            if (result.status === 'ok') {
                onHoldingsChange?.();
                setStatusMessage(
                    tToast('holdingSaved', { v0: result.holding.symbol })
                );
            }
            return result;
        },
        [saveHolding, onHoldingsChange, tToast]
    );

    const saveEdit = useCallback(
        async (
            symbol: string,
            input: RawHoldingInput
        ): Promise<SavePortfolioResult> => {
            const result = await saveAndAnnounce(input);
            if (result.status === 'ok') {
                setEditingSymbol(closeIfCurrent(symbol));
            }
            return result;
        },
        [saveAndAnnounce]
    );

    const confirmDelete = useCallback(
        async (symbol: string): Promise<void> => {
            setDeleteError(null);
            setStatusMessage(null);
            const result = await resolveOrNull(removeHolding, symbol);
            if (result === null) {
                setDeleteError({
                    symbol,
                    message: t('PortfolioSection.19d04f'),
                });
                return;
            }
            if (result.status === 'error') {
                setDeleteError({ symbol, message: result.message });
                return;
            }
            setConfirmingDeleteSymbol(closeIfCurrent(symbol));
            setStatusMessage(tToast('holdingDeleted', { v0: symbol }));
            onHoldingsChange?.();
            setDeleteSuccessTick(tick => tick + 1);
        },
        [removeHolding, t, tToast, onHoldingsChange]
    );

    const listView = resolveHoldingsListView(
        !isHydrated || isLoading,
        isError,
        holdings.length
    );
    const deletingSymbol = remove.isPending ? (remove.variables ?? null) : null;

    useEffect(() => {
        if (deleteSuccessTick === handledDeleteTickRef.current) return;
        handledDeleteTickRef.current = deleteSuccessTick;
        // 응답을 기다리는 사이 사용자가 다른 행의 편집·삭제 확인을 열었다면 그 행이 포커스를 갖고
        // 있으므로 제목으로 빼앗지 않는다.
        if (editingSymbol === null && confirmingDeleteSymbol === null) {
            headingRef.current?.focus();
        }
    }, [deleteSuccessTick, editingSymbol, confirmingDeleteSymbol]);

    return {
        holdings,
        listView,
        refetch,
        headingRef,
        statusMessage,
        editingSymbol,
        confirmingDeleteSymbol,
        deletingSymbol,
        deleteError,
        startEdit,
        cancelEdit,
        saveEdit,
        requestDelete,
        cancelDelete,
        confirmDelete,
        addHolding: saveAndAnnounce,
    };
}
