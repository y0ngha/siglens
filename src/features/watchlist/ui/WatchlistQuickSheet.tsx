'use client';

import { useTranslations } from 'next-intl';
import { Drawer } from 'vaul';
import { WatchlistPreviewPanel } from './WatchlistPreviewPanel';

interface WatchlistQuickSheetProps {
    readonly open: boolean;
    readonly onOpenChange: (open: boolean) => void;
}

/**
 * 모바일(`lg` 미만) 관심종목 바텀시트. vaul을 이 파일에만 두는 이유는 번들이다 —
 * `WatchlistQuickButton`이 `next/dynamic`으로 처음 열 때만 불러오므로 첫 로드 JS에 실리지 않는다.
 *
 * 모달 시트다: 배경 스크롤을 잠그고(iOS 포함 vaul이 처리), 포커스를 시트 안에 가두고, 바깥을
 * 누르면 닫힌다. 시트 높이는 항목 수와 무관하게 고정이고 **목록 영역만** 스크롤한다. 아래로
 * 끌어 닫기는 vaul이 스크롤 영역의 `scrollTop`을 보고 맨 위일 때만 허용한다 — 목록 중간에서
 * 끌면 스크롤이 된다.
 */
export function WatchlistQuickSheet({
    open,
    onOpenChange,
}: WatchlistQuickSheetProps) {
    const t = useTranslations('features.watchlist');
    return (
        <Drawer.Root open={open} onOpenChange={onOpenChange}>
            <Drawer.Portal>
                <Drawer.Overlay className="fixed inset-0 z-[60] bg-black/60" />
                {/* `data-modal-sheet`: 열려 있는 동안 globals.css가 PWA 설치 배너·Ask-AI FAB을 숨긴다.
                    모달 시트는 바깥 요소의 pointer-events를 끄므로(Radix Dialog), 시트 위에 떠 있는
                    배너의 X를 누르면 탭이 배너를 통과해 아래의 시트 링크("관심종목 설정하기")가 눌렸다. */}
                <Drawer.Content
                    data-modal-sheet
                    aria-describedby={undefined}
                    className="fixed inset-x-0 bottom-0 z-[60] flex h-[min(80svh,40rem)] flex-col rounded-t-lg border-t border-secondary-600 bg-secondary-800 outline-none"
                >
                    <div
                        aria-hidden="true"
                        className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-secondary-600"
                    />
                    <Drawer.Title className="sr-only">
                        {t('preview.title')}
                    </Drawer.Title>
                    <WatchlistPreviewPanel
                        variant="sheet"
                        quotesEnabled={open}
                        onNavigate={() => onOpenChange(false)}
                    />
                </Drawer.Content>
            </Drawer.Portal>
        </Drawer.Root>
    );
}
