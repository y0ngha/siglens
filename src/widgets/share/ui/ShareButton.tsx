'use client';

import { useTranslations } from 'next-intl';
import { useShareFlow } from '@/features/share/hooks/useShareFlow';
import { cn } from '@/shared/lib/cn';
import dynamic from 'next/dynamic';
import { Spinner } from '@/shared/ui/Spinner';
import { ShareIcon } from './icons';

/*
 * 공유 시트·확인 대화상자·준비 중 모달은 **열릴 때** 받는다. 공유 버튼은 모든 종목 탭
 * 헤더에 있지만 누르는 사람은 소수라, 세 패널과 그 의존(포커스 트랩·클립보드 훅)을
 * 종목 페이지 first-load에 실을 이유가 없다. 셋 다 열린 동안만 마운트되는 컴포넌트라
 * (`open=false`면 null) 조건부 마운트로 바꿔도 동작이 같다.
 *
 * 첫 클릭이 청크 왕복만큼 조용히 멈추지 않도록, 버튼에 포인터가 올라가거나 포커스가 가면
 * 미리 받아 둔다(`preloadShareDialogs`). 같은 모듈의 `import()`는 한 번만 받는다.
 */
const loadShareSheet = () => import('./ShareSheet');
const loadShareTriggerDialog = () => import('./ShareTriggerDialog');
const loadSharePreparingModal = () => import('./SharePreparingModal');

const ShareSheet = dynamic(() => loadShareSheet().then(m => m.ShareSheet), {
    ssr: false,
});
const ShareTriggerDialog = dynamic(
    () => loadShareTriggerDialog().then(m => m.ShareTriggerDialog),
    { ssr: false }
);
const SharePreparingModal = dynamic(
    () => loadSharePreparingModal().then(m => m.SharePreparingModal),
    { ssr: false }
);

function preloadShareDialogs(): void {
    // 미리 받기는 최선 노력이다 — 실패해도 클릭 때 다시 받는다.
    void Promise.all([
        loadShareSheet(),
        loadShareTriggerDialog(),
        loadSharePreparingModal(),
    ]).catch(() => {});
}

/**
 * Header button that orchestrates the share flow for the current analysis tab.
 *
 * All state-machine logic (mutation, auto-advance, native-share vs sheet branching,
 * sheet/dialog/preparing state) lives in useShareFlow() from @/features/share.
 * This component is purely presentational: it reads the hook's return value and
 * renders the appropriate UI elements.
 */
export function ShareButton() {
    const t = useTranslations('widgets.share');
    const {
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
    } = useShareFlow();

    return (
        <div className="relative">
            <button
                ref={buttonRef}
                type="button"
                aria-label={t('ShareButton.281cf1')}
                aria-busy={isMutating ? 'true' : undefined}
                aria-describedby={
                    unavailableVisible ? describedById : undefined
                }
                disabled={isMutating}
                onClick={onClick}
                onPointerEnter={preloadShareDialogs}
                onFocus={preloadShareDialogs}
                className={cn(
                    'border-border-control text-secondary-300 inline-flex size-11 items-center justify-center rounded-lg border',
                    'hover:border-primary-500 hover:bg-secondary-700/30 hover:text-secondary-100',
                    'focus-visible:ring-primary-500 focus-visible:ring-2 focus-visible:outline-none',
                    'touch-manipulation transition-colors'
                )}
            >
                {isMutating ? (
                    <Spinner size="lg" />
                ) : (
                    <ShareIcon className="h-5 w-5" />
                )}
            </button>

            {unavailableVisible && (
                <p
                    id={describedById}
                    role="status"
                    className="absolute top-full right-0 z-50 mt-1 w-max max-w-xs rounded-lg border border-secondary-700 bg-secondary-900 px-3 py-2 text-xs text-secondary-400 shadow-lg"
                >
                    {t('ShareButton.30b27f')}
                </p>
            )}

            {sheetOpen && shareUrl && (
                <ShareSheet
                    shareUrl={shareUrl}
                    tweetText={tweetText}
                    title={t('ShareButton.shareTitle', { v0: symbol })}
                    description={tweetText}
                    onClose={onSheetClose}
                />
            )}

            {triggerDialogOpen && (
                <ShareTriggerDialog
                    open
                    onConfirm={onTriggerConfirm}
                    onCancel={onTriggerCancel}
                />
            )}

            {preparingOpen && (
                <SharePreparingModal
                    open
                    phase={preparingPhase}
                    onClose={onPreparingClose}
                    onRetry={onPreparingRetry}
                />
            )}
        </div>
    );
}
