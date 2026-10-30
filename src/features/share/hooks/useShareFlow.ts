'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import type { Tier } from '@y0ngha/siglens-core';
import { useCurrentLocale } from '@/shared/i18n/LocaleContext';
import { useUserTier } from '@/features/symbol-model/hooks/useUserTier';
import { createShareSnapshotAction } from '@/entities/shared-analysis/actions/createShareSnapshotAction';
import { useShareable } from '../model/ShareableAnalysisContext';
import type {
    ShareableRegistration,
    ShareableStatus,
} from '../model/ShareableAnalysisContext';
import { buildShareSnapshotInput } from '../lib/buildShareSnapshotInput';
import { buildShareUrl } from '../lib/shareUrl';
import { deliverShare } from '../lib/deliverShare';
import { SHARE_CLICK_ACTION } from '../lib/shareClickAction';

/**
 * Return type of useShareFlow — contains all state and handlers that
 * ShareButton needs to render and respond to user interaction.
 */
export interface UseShareFlowResult {
    /** Effective share status, 'unavailable' when no registration. */
    status: ShareableStatus;
    /** True while the createShareSnapshotAction mutation is in flight. */
    isMutating: boolean;
    /** Controls the bottom-sheet that shows the share URL / tweet link. */
    sheetOpen: boolean;
    /** Controls the "trigger analysis to share" confirmation dialog. */
    triggerDialogOpen: boolean;
    /** Controls the analysis-preparing modal (includes error phase). */
    preparingOpen: boolean;
    /** Phase shown inside the preparing modal. */
    preparingPhase: 'pending' | 'error';
    /** True when the inline "unavailable" notice should be visible. */
    unavailableVisible: boolean;
    /** The share URL after a successful snapshot, needed by ShareSheet. */
    shareUrl: string | null;
    /** Tweet text derived from the symbol context. */
    tweetText: string;
    /** aria-describedby id for the unavailable notice element. */
    describedById: string;
    /** Symbol string for rendering titles / aria labels. */
    symbol: string;
    /** Ref to pass to the trigger button element for focus management. */
    buttonRef: React.RefObject<HTMLButtonElement | null>;
    /** Click handler for the main share button. */
    onClick: () => void;
    /** Called when the user confirms the trigger dialog. */
    onTriggerConfirm: () => void;
    /** Called when the user cancels the trigger dialog. */
    onTriggerCancel: () => void;
    /** Called when the preparing modal closes (✕ or background). */
    onPreparingClose: () => void;
    /** Called when the user retries from inside the preparing modal. */
    onPreparingRetry: () => void;
    /** Called when the share sheet closes. */
    onSheetClose: () => void;
}

/**
 * Orchestrates the full share flow for the currently active analysis tab.
 *
 * A click is routed by `SHARE_CLICK_ACTION` on the registration status:
 * - 'unavailable' (or nothing registered) → inline notice.
 * - 'success' → createShareSnapshotAction → native share or ShareSheet.
 * - 'pending' → SharePreparingModal while the analysis already runs.
 * - 'idle' / 'error' → ShareTriggerDialog; on confirm → reg.trigger() + modal.
 *
 * Auto-advance: while the preparing modal is open, an effect watches for the
 * registration to reach 'success' and starts the share without any setState
 * (react-hooks/set-state-in-effect). The modal is closed from the mutation's
 * async callbacks.
 */
export function useShareFlow(): UseShareFlowResult {
    const [sheetOpen, setSheetOpen] = useState(false);
    const [triggerDialogOpen, setTriggerDialogOpen] = useState(false);
    /**
     * Open while the user waits for an analysis to finish so it can be shared.
     * It also gates auto-advance and the error phase, so an already-errored
     * registration never auto-shares or shows the error before the user acts.
     */
    const [preparingOpen, setPreparingOpen] = useState(false);
    const [shareUrl, setShareUrl] = useState<string | null>(null);
    const [unavailableVisible, setUnavailableVisible] = useState(false);

    const buttonRef = useRef<HTMLButtonElement>(null);
    /**
     * Stable refs to the latest reg and sharerTier values. The mutation fn reads
     * these so it always operates on the current registration even when called
     * from within the auto-advance effect (where the closure would otherwise close
     * over a stale 'pending' reg). Updated in a no-dep useEffect (runs after every
     * render) so they are never read during render itself.
     */
    const regRef = useRef<ShareableRegistration | null>(null);
    const sharerTierRef = useRef<Tier>('free');
    /**
     * Stable ref to mutation.mutate so runShare's identity never changes across
     * renders. Without this, every mutation state update (idle→pending→success)
     * would produce a new `mutation` object, a new `runShare`, and re-fire the
     * auto-advance effect while the preparing modal is still open — causing a
     * double mutate().
     */
    const mutateRef = useRef<() => void>(() => undefined);

    const reg = useShareable();
    const { tier: sharerTier } = useUserTier();
    const locale = useCurrentLocale();
    const t = useTranslations('features.share.useShareFlow');
    const describedById = useId();

    /**
     * Reset all transient UI state when the user switches to a different analysis tab.
     *
     * Uses the getDerivedStateFromProps-equivalent pattern (setState during render)
     * to avoid the react-hooks/set-state-in-effect lint rule while still resetting
     * synchronously before the next paint. Declared after `useShareable` because
     * it compares against `reg.kind`.
     */
    const [prevKind, setPrevKind] = useState(reg?.kind);
    if (prevKind !== reg?.kind) {
        setPrevKind(reg?.kind);
        setSheetOpen(false);
        setTriggerDialogOpen(false);
        setPreparingOpen(false);
        setUnavailableVisible(false);
    }

    const mutation = useMutation({
        mutationFn: async () => {
            const input = buildShareSnapshotInput(
                regRef.current,
                sharerTierRef.current
            );
            if (input === null) {
                throw new Error('No shareable result available');
            }
            return createShareSnapshotAction(input);
        },
        // Network / unexpected throw: dismiss the preparing modal so it doesn't stay stuck.
        onError: () => {
            setPreparingOpen(false);
        },
        onSuccess: async result => {
            if (!result.ok) {
                // Action-level error (e.g. rate_limited, persist_failed).
                setPreparingOpen(false);
                return;
            }
            const url = buildShareUrl(locale, result.id);
            setShareUrl(url);

            const symbol = regRef.current?.context.symbol ?? '';
            // 이 문자열은 **X에 실제로 게시되는 본문**이라 UI 로케일을 따른다.
            const delivery = await deliverShare({
                title: t('shareTitle', { v0: symbol }),
                text: t('shareText', { v0: symbol }),
                url,
            });
            // 전달(OS 시트)이 끝난 뒤에야 모달을 닫는다. 자동 진행 effect는
            // preparingOpen이 true인 동안만 동작하므로, 시트가 열려 있는 동안
            // reg.result 참조가 바뀌면 다시 발동할 수 있다(이전 동작 유지:
            // 기존 hasTriggered 게이트도 같은 시점에 해제됐다).
            setPreparingOpen(false);
            if (delivery === 'sheet') setSheetOpen(true);
        },
    });

    /**
     * Shared share-execution function used by both the direct success-click path and
     * the auto-advance effect. Stable identity prevents the auto-advance effect from
     * re-firing due to mutation state changes mid-flight.
     */
    const runShare = useCallback(() => {
        mutateRef.current();
    }, []);

    const effectiveStatus = reg?.status ?? 'unavailable';
    const isMutating = mutation.isPending;
    const preparingPhase =
        preparingOpen && reg?.status === 'error' ? 'error' : 'pending';
    const symbol = reg?.context.symbol ?? '';
    const tweetText = t('shareText', { v0: symbol });

    const onClick = useCallback(() => {
        // Prevent double-click while mutation is in flight.
        if (isMutating) return;
        const action = SHARE_CLICK_ACTION[effectiveStatus];
        // Each click hides a stale notice unless this click shows it again.
        setUnavailableVisible(action === 'notice');
        switch (action) {
            case 'notice':
                return;
            case 'share':
                runShare();
                return;
            case 'wait':
                setPreparingOpen(true);
                return;
            case 'confirm':
                setTriggerDialogOpen(true);
                return;
        }
    }, [isMutating, effectiveStatus, runShare]);

    const onTriggerConfirm = useCallback(() => {
        setTriggerDialogOpen(false);
        reg?.trigger();
        setPreparingOpen(true);
    }, [reg]);

    const onTriggerCancel = useCallback(() => {
        setTriggerDialogOpen(false);
        buttonRef.current?.focus();
    }, []);

    const onPreparingClose = useCallback(() => {
        setPreparingOpen(false);
        buttonRef.current?.focus();
    }, []);

    const onPreparingRetry = useCallback(() => {
        reg?.trigger();
    }, [reg]);

    const onSheetClose = useCallback(() => {
        setSheetOpen(false);
        buttonRef.current?.focus();
    }, []);

    /**
     * Keep all stable refs in sync with the latest values so callbacks and the
     * mutation fn always read up-to-date state without stale closure issues.
     * No deps (runs after every render) — intentional: always reflects latest values.
     * Declared before the auto-advance effect so the refs are fresh when it fires.
     */
    useEffect(() => {
        regRef.current = reg;
        sharerTierRef.current = sharerTier;
        mutateRef.current = mutation.mutate;
    });

    /**
     * While the preparing modal is open, share as soon as the registration
     * reaches 'success'. Only calls runShare() — a React Query side effect — and
     * no setState, so react-hooks/set-state-in-effect holds.
     */
    useEffect(() => {
        if (!preparingOpen) return;
        if (reg?.status === 'success' && reg.result != null) {
            runShare();
        }
    }, [preparingOpen, reg?.status, reg?.result, runShare]);

    return {
        status: effectiveStatus,
        isMutating,
        sheetOpen,
        triggerDialogOpen,
        preparingOpen,
        preparingPhase,
        unavailableVisible,
        shareUrl,
        tweetText,
        describedById,
        symbol,
        buttonRef,
        onClick,
        onTriggerConfirm,
        onTriggerCancel,
        onPreparingClose,
        onPreparingRetry,
        onSheetClose,
    };
}
