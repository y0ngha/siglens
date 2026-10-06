'use client';

import { useTranslations } from 'next-intl';
import { usePwaInstall } from '../hooks/usePwaInstall';
import { IosInstallModal } from './IosInstallModal';
import { cn } from '@/shared/lib/cn';
import { BUTTON_PRIMARY } from '@/shared/lib/buttonStyles';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { CloseIcon } from '@/shared/ui/StrokeIcons';

/**
 * PWA 설치 배너 — 화면 **하단에 떠 있는** 오버레이.
 *
 * 예전에는 헤더 위 흐름에 `h-12`로 삽입돼 본문 전체를 3rem 밀었다. 첫 입력 직후에만
 * 띄워 CLS 제외 창(입력 500ms)에 기대었지만, 스크롤로 시작하는 `pointerdown`이
 * 그 "입력"으로 인정되는지는 브라우저 판정에 달려 있어 레이아웃 이동이 남았다.
 * 게다가 `/[symbol]`의 jail·차트 높이가 `--pwa-banner-h`로 배너 높이를 빼야 했다.
 * 고정 오버레이는 흐름 높이를 차지하지 않으므로 두 문제가 같이 사라진다.
 *
 * ## 배치와 겹침 (z-65)
 *
 * - 모바일(<640px): 좌우 여백을 둔 전폭 카드. 오른쪽 아래 `AskAiFab`(z-60)과 같은
 *   자리라, 배너가 떠 있는 동안 globals.css가 FAB을 배너 위로 올린다
 *   (`[data-pwa-banner]` 규칙). 배너가 FAB보다 위(z-65)인 이유는 그 규칙이 깨져도
 *   설치·닫기 버튼이 가려지지 않게 하기 위해서다.
 * - sm 이상: 왼쪽 아래 `w-96` 카드. FAB은 오른쪽이라 겹치지 않는다.
 * - 모바일 분석 시트(z-50): PEEK 띠 위에는 배너가 뜨고(FAB과 같은 관계), 시트가
 *   HALF/FULL로 펼쳐지면 globals.css가 배너를 숨긴다 — 분석 본문을 가리지 않는다.
 * - 검색 오버레이·모바일 메뉴(z-70), 진행 바(z-80), 공지·모달(z-9999)은 배너 위다.
 *
 * 하단 safe-area(홈 인디케이터)만큼 띄운다 — 앱은 `viewportFit: 'cover'`다.
 */
export function PwaBanner() {
    const t = useTranslations('features.pwa-install');
    const {
        showBanner,
        showIosModal,
        isIos,
        handleInstall,
        handleDismiss,
        handleModalClose,
    } = usePwaInstall();

    if (!showBanner) {
        return null;
    }

    return (
        <>
            <div
                data-testid="pwa-banner-shell"
                data-pwa-banner
                // 화면에 떠 있는 고정 오버레이라 랜드마크로 노출해 스크린리더가 이름으로
                // 찾아가거나 건너뛸 수 있게 한다.
                role="region"
                aria-label={t('PwaBanner.31ff7b')}
                className={cn(
                    SURFACE_CARD,
                    'fixed right-[max(0.75rem,env(safe-area-inset-right))] bottom-[calc(0.75rem+env(safe-area-inset-bottom))] left-[max(0.75rem,env(safe-area-inset-left))] z-65 flex h-12 items-center gap-2 pr-1.5 pl-3 shadow-lg sm:right-auto sm:left-4 sm:w-96'
                )}
            >
                <span className="text-base" aria-hidden="true">
                    📈
                </span>
                {/* 두 줄까지 허용한다 — 카드가 좌우 여백을 가진 뒤로 390px에서 한 줄
                    말줄임이 문장 끝("있어요")을 잘랐다. text-xs 두 줄(2rem)은 h-12 안에 든다. */}
                <span className="line-clamp-2 min-w-0 flex-1 text-xs leading-4 text-secondary-200">
                    {t('PwaBanner.ba5aad')}
                </span>
                <button
                    type="button"
                    onClick={handleInstall}
                    className={cn(
                        BUTTON_PRIMARY,
                        'shrink-0 touch-manipulation rounded-full px-3 py-1 text-xs'
                    )}
                >
                    {t('PwaBanner.15236a')}
                </button>
                <button
                    type="button"
                    onClick={handleDismiss}
                    aria-label={t('PwaBanner.9631f3')}
                    // 아이콘은 16px지만 누르는 면은 36px — 손가락으로 X를 정확히 맞히지
                    // 않아도 닫힌다. 카드 높이(h-12) 안에 들어가는 최대 크기다.
                    className="inline-flex size-9 shrink-0 touch-manipulation items-center justify-center rounded text-secondary-400 transition-colors hover:text-secondary-200 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                >
                    <CloseIcon className="size-4" />
                </button>
            </div>
            {isIos && showIosModal && (
                <IosInstallModal onClose={handleModalClose} />
            )}
        </>
    );
}
