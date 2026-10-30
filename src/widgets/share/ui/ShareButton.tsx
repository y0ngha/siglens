'use client';

/**
 * 종목 헤더의 공유 진입점 — 공유 흐름 훅의 상태를 버튼·안내·지연 로드 패널로 그린다.
 */

import { useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';
import { useShareFlow } from '@/features/share/hooks/useShareFlow';
import { ShareTriggerButton } from './button/ShareTriggerButton';
import { ShareUnavailableNotice } from './button/ShareUnavailableNotice';

/*
 * 공유 시트·확인 대화상자·준비 중 모달은 **열릴 때** 받는다. 공유 버튼은 모든 종목 탭
 * 헤더에 있지만 누르는 사람은 소수라, 세 패널과 그 의존(포커스 트랩·클립보드 훅)을
 * 종목 페이지 first-load에 실을 이유가 없다. 셋 다 열린 동안만 마운트되는 컴포넌트라
 * 조건부 마운트로 열림을 표현한다.
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
 * 현재 분석 탭의 공유 버튼.
 *
 * 상태 머신(스냅샷 생성, 분석 완료 뒤 자동 진행, 네이티브 공유와 시트의 분기)은
 * `useShareFlow`가 갖고, 이 컴포넌트는 그 결과를 그리기만 한다.
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

    // 시트가 열린 채 버튼을 다시 누르면 닫는다. 공유를 다시 돌리면 같은 분석의
    // 스냅샷이 서버에 하나 더 만들어진다.
    const handleTriggerClick = sheetOpen ? onSheetClose : onClick;

    return (
        <div className="relative">
            <ShareTriggerButton
                buttonRef={buttonRef}
                pending={isMutating}
                describedById={unavailableVisible ? describedById : undefined}
                onClick={handleTriggerClick}
                onPreload={preloadShareDialogs}
            />

            <ShareUnavailableNotice
                id={describedById}
                visible={unavailableVisible}
            />

            {sheetOpen && shareUrl && (
                <ShareSheet
                    shareUrl={shareUrl}
                    tweetText={tweetText}
                    title={t('ShareButton.shareTitle', { v0: symbol })}
                    anchorRef={buttonRef}
                    onClose={onSheetClose}
                />
            )}

            {triggerDialogOpen && (
                <ShareTriggerDialog
                    onConfirm={onTriggerConfirm}
                    onCancel={onTriggerCancel}
                />
            )}

            {preparingOpen && (
                <SharePreparingModal
                    phase={preparingPhase}
                    onClose={onPreparingClose}
                    onRetry={onPreparingRetry}
                />
            )}
        </div>
    );
}
