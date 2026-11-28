'use client';

/**
 * AdSense 수동 광고 한 칸. 서버 HTML에는 고정 높이 상자와 "광고" 라벨만 그리고, 클라이언트에서
 * 노출 조건(`useAdActivation`)을 만족하면 상자 안에 광고 단위를 넣는다.
 *
 * - 상자를 먼저 잡는 이유: 광고가 늦게 와도, 오지 않아도(no-fill) 아래 본문이 밀리지 않게(CLS).
 *   그래서 광고가 비어도 상자를 접지 않는다.
 * - Pro로 확인되면 상자를 렌더하지 않는다. `display:none`으로 숨기는 것은 AdSense 정책상 금지다.
 *   서버 HTML은 등급을 모르므로 Pro 회원에게는 상자가 잠깐 그려졌다가 빠진다(화면 밀림). 광고 대상인
 *   비회원·무료 회원의 밀림을 없애는 쪽을 택한 의도된 대가다 — 로그인 힌트 쿠키는 등급을 담지 않아
 *   서버에서 Pro를 미리 가를 수 없다.
 * - 광고 단위는 고정 크기다. 반응형(`data-full-width-responsive`)은 좁은 화면에서 본문 폭을 넘어
 *   가로 스크롤을 만든다.
 * - 광고 스크립트도 이 컴포넌트가 불러온다(`next/script`가 같은 id를 한 번만 넣는다). 광고 자리가
 *   없는 페이지와 사람 입력이 없는 세션에는 스크립트가 아예 실리지 않는다.
 * - 라벨은 "광고"(로케일별 번역)만 쓴다. AdSense는 "광고"/"스폰서 링크" 외의 라벨과 클릭을
 *   부탁하는 문구를 금지한다.
 */
import { useTranslations } from 'next-intl';
import Script from 'next/script';
import { useRef, useState, useSyncExternalStore } from 'react';
import { useAdActivation } from '@/features/ad-slot/hooks/useAdActivation';
import { useAdSensePush } from '@/features/ad-slot/hooks/useAdSensePush';
import {
    AD_PLACEMENTS,
    type AdPlacement,
    type AdSize,
    isAdPlacementConfigured,
} from '@/features/ad-slot/model/adPlacement';
import { ADSENSE_PUBLISHER_ID, ADSENSE_SCRIPT_SRC } from '@/shared/lib/adsense';
import { cn } from '@/shared/lib/cn';

/** `md` 브레이크포인트. 예약 상자의 `md:h-[…]`와 같은 경계여야 상자와 광고 높이가 맞는다. */
const DESKTOP_QUERY = '(min-width: 768px)';

interface AdSlotProps {
    readonly placement: AdPlacement;
    readonly className?: string;
}

export function AdSlot({ placement, className }: AdSlotProps) {
    // 빌드 상수라 렌더마다 같은 값이다 — 훅 순서가 바뀌지 않는다.
    if (!isAdPlacementConfigured(placement)) return null;
    return <ConfiguredAdSlot placement={placement} className={className} />;
}

function ConfiguredAdSlot({ placement, className }: AdSlotProps) {
    const t = useTranslations('features.ad-slot');
    const config = AD_PLACEMENTS[placement];
    // 콜백 ref로 노드를 상태에 담는다 — `useAdActivation` JSDoc(상자가 늦게 생겨도 관찰이 시작되게).
    const [box, setBox] = useState<HTMLDivElement | null>(null);
    const { tier, active } = useAdActivation(box, config.load);

    if (tier === 'hide') return null;

    return (
        <aside
            aria-label={t('label')}
            className={cn('my-8 flex flex-col items-center gap-1.5', className)}
        >
            <p aria-hidden className="text-xs text-secondary-400">
                {t('label')}
            </p>
            <div
                ref={setBox}
                className={cn(
                    'flex w-full items-center justify-center overflow-hidden rounded-lg bg-secondary-900/40',
                    config.boxClassName
                )}
            >
                {active && (
                    <AdUnit
                        slotId={config.slotId}
                        mobile={config.mobile}
                        desktop={config.desktop}
                    />
                )}
            </div>
        </aside>
    );
}

interface AdUnitProps {
    readonly slotId: string;
    readonly mobile: AdSize;
    readonly desktop: AdSize;
}

/** `md` 이상인지. 서버 스냅샷은 쓰이지 않는다 — `AdUnit`은 활성화 뒤 클라이언트에서만 마운트된다. */
function subscribeDesktop(onChange: () => void): () => void {
    const query = window.matchMedia(DESKTOP_QUERY);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
}
const isDesktopNow = () => window.matchMedia(DESKTOP_QUERY).matches;
const isDesktopOnServer = () => false;

/** 활성화 뒤에만 마운트된다. */
function AdUnit({ slotId, mobile, desktop }: AdUnitProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const isDesktop = useSyncExternalStore(
        subscribeDesktop,
        isDesktopNow,
        isDesktopOnServer
    );
    // 크기는 마운트 때 한 번 고른다. 화면을 돌려도 바꾸지 않는다 — 광고를 다시 요청하는 것은
    // 사용자가 요청하지 않은 새로고침이라 금지다.
    const [size] = useState(() => (isDesktop ? desktop : mobile));
    useAdSensePush(containerRef, true);

    return (
        <div ref={containerRef} style={{ width: size.width }}>
            <Script
                id="adsbygoogle-js"
                src={ADSENSE_SCRIPT_SRC}
                strategy="afterInteractive"
                crossOrigin="anonymous"
            />
            <ins
                className="adsbygoogle"
                style={{
                    display: 'inline-block',
                    width: size.width,
                    height: size.height,
                }}
                data-ad-client={ADSENSE_PUBLISHER_ID}
                data-ad-slot={slotId}
            />
        </div>
    );
}
