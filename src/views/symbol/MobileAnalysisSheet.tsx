'use client';

import { useTranslations } from 'next-intl';
import { type ReactNode } from 'react';
import { Drawer } from 'vaul';
import { cn } from '@/shared/lib/cn';
import { SNAP_POINTS_MUTABLE, type SnapPoint } from './constants/mobileSheet';
import { useMobileAnalysisSheet } from './hooks/useMobileAnalysisSheet';
import { useMobileSheetDrag } from './hooks/useMobileSheetDrag';

interface MobileAnalysisSheetProps {
    activeSnap: SnapPoint;
    onActiveSnapChange: (snap: SnapPoint) => void;
    children: ReactNode;
}

/**
 * 모바일 분석 바텀시트.
 *
 * `modal={false}`는 반드시 Radix Dialog까지 도달해야 한다. vaul 1.1.2는 이 prop을
 * 내부 `DialogPrimitive.Root`에 전달하지 않는 회귀가 있어(업스트림 이슈
 * https://github.com/emilkowalski/vaul/issues/496, PR #424에서 유입), Radix가
 * modal 모드로 동작하면 FocusScope가 시트 밖 입력의 포커스를 빼앗고(평단
 * 팝오버·헤더 검색·챗봇 입력이 모두 먹통), `hideOthers`가 앱 트리 전체에
 * `aria-hidden`을 붙이며, `body`에 `pointer-events: none`이 적용된다.
 *
 * 그래서 `.yarn/patches/vaul-npm-1.1.2-*.patch`로 passthrough를 복구했고,
 * `src/shared/lib/__tests__/vaulPatchIntegrity.test.ts`가 패치 유실을 감시한다.
 * 패치 덕분에 예전의 body pointer-events 복구용 MutationObserver 핵은 제거했다.
 *
 * D2(감사) — 이 패치의 제거 조건: 업스트림 이슈 #496이 closed되고 vaul이
 * `modal` passthrough를 정식으로 릴리스하면, 다음을 전부 제거한다 —
 * (1) `.yarn/patches/vaul-npm-1.1.2-*.patch` 파일 자체, (2) `package.json`
 * `dependencies.vaul`의 `patch:vaul@npm%3A1.1.2#~/.yarn/patches/...` 지정자를
 * 평범한 semver 지정자로 되돌리기, (3)
 * `src/shared/lib/__tests__/vaulPatchIntegrity.test.ts`. vaul을 업그레이드하는
 * 순간 그 테스트는 설계상 실패한다(같은 파일의 JSDoc 참고) — 그것이 바로 이
 * 제거를 수행할 신호다.
 */
export function MobileAnalysisSheet({
    activeSnap,
    onActiveSnapChange,
    children,
}: MobileAnalysisSheetProps) {
    const t = useTranslations('views.symbol');
    const {
        isOpen,
        isFullSnap,
        contentRef,
        drawerContentRef,
        handleOpenChange,
    } = useMobileAnalysisSheet({ activeSnap, onActiveSnapChange });

    useMobileSheetDrag({
        scrollElRef: contentRef,
        drawerElRef: drawerContentRef,
        isFullSnap,
        onSnapChange: onActiveSnapChange,
    });

    return (
        <Drawer.Root
            open={isOpen}
            onOpenChange={handleOpenChange}
            modal={false}
            dismissible={false}
            snapPoints={SNAP_POINTS_MUTABLE}
            activeSnapPoint={activeSnap}
            setActiveSnapPoint={onActiveSnapChange}
            handleOnly={isFullSnap}
            snapToSequentialPoint
        >
            <Drawer.Portal>
                <Drawer.Content
                    ref={drawerContentRef}
                    // h-[97svh] 고정 — vaul의 snap translateY는 뷰포트 고정값(예: PEEK 654.5px)이므로
                    // max-h로 두면 콘텐츠가 줄어들 때 드로어가 함께 축소되어 PEEK 위치에서
                    // 완전히 뷰포트 밖으로 밀려나는 "사라짐" 버그가 발생한다.
                    className="fixed inset-x-0 bottom-0 z-50 flex h-[97svh] flex-col overflow-hidden overscroll-contain rounded-t-2xl border-t border-secondary-700 bg-secondary-900 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_-8px_rgba(0,0,0,0.6)] md:hidden"
                    aria-live="polite"
                >
                    <Drawer.Handle
                        className="shrink-0"
                        aria-label={t('MobileAnalysisSheet.3298a7')}
                    />
                    <Drawer.Title className="sr-only">
                        {t('MobileAnalysisSheet.2f1956')}
                    </Drawer.Title>
                    <Drawer.Description className="sr-only">
                        {t('MobileAnalysisSheet.1ce2db')}
                    </Drawer.Description>
                    <div
                        ref={contentRef}
                        className={cn(
                            'min-h-0 flex-1 px-4 pt-3 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)]',
                            isFullSnap ? 'overflow-y-auto' : 'overflow-hidden'
                        )}
                    >
                        {children}
                    </div>
                </Drawer.Content>
            </Drawer.Portal>
        </Drawer.Root>
    );
}
