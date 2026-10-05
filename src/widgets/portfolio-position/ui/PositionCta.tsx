'use client';

import { useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';
import { BUTTON_PRIMARY } from '@/shared/lib/buttonStyles';
import { cn } from '@/shared/lib/cn';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import { computePosition } from '../lib/positionGeometry';
import { formatAmount } from '../lib/positionBuildingNotes';

// 건물(SVG·층 툴팁·포털 코드)은 CTA 문구보다 늦게 와도 되는 장식·정보 보강이라
// 코드 분할한다. 비회원 경로는 메인 청크에 이 코드를 싣지 않는다. 호출 경로가 이미
// `useHydrated()` 뒤라 SSR로 그려질 일이 없어 `ssr: false`다.
//
// 로딩 자리는 건물과 같은 높이를 잡아 도착 시 CTA가 밀리지 않게 한다(CLS). 건물은
// 정사각형 SVG(브레이크포인트 폭 상한 280/340/440px)에, 거래량 비중이 있으면 그 아래
// 층 거래량 안내 줄(`gap-2` + `min-h-[1rem]`)이 더 붙는다. `dynamic`의 loading은
// props를 받지 못하므로 두 경우를 별도 선언으로 나눈다(같은 청크를 공유한다).
const loadPositionBuilding = () =>
    import('./PositionBuilding').then(m => m.PositionBuilding);

function BuildingPlaceholder({ withReadout }: { withReadout: boolean }) {
    return (
        <div
            aria-hidden="true"
            data-testid="position-cta-building-loading"
            className="flex w-full flex-col items-center gap-2"
        >
            <div className="aspect-square w-full max-w-[280px] sm:max-w-[340px] lg:max-w-[440px]" />
            {withReadout && <div className="min-h-[1rem]" />}
        </div>
    );
}

const PositionBuilding = dynamic(loadPositionBuilding, {
    ssr: false,
    loading: () => <BuildingPlaceholder withReadout={false} />,
});

const PositionBuildingWithReadout = dynamic(loadPositionBuilding, {
    ssr: false,
    loading: () => <BuildingPlaceholder withReadout />,
});

interface PositionCtaProps {
    symbol: string;
    low52w: number | null;
    high52w: number | null;
    /** 현재가(마지막 종가). null이면 건물을 그릴 수 없어 문구만 보인다. */
    lastClose: number | null;
    /** 5개 가격대별 최근 거래량 비중(%) — 건물의 층 hover로 그대로 전달만 한다. */
    volumeByBand?: readonly number[] | null;
}

/**
 * Shared CTA card shown to both anonymous visitors and members with no holding
 * on this symbol — "내 위치" needs an avg purchase price to draw a building, so
 * there is nothing personalized to render for either audience. Kept as a plain
 * presentational component (no state/effects) so the guest gate in
 * `PositionTabContent` can render it directly without pulling in the lazy member
 * chunk. 'use client' is only here for `next/dynamic({ ssr: false })` (building).
 *
 * 건물이 그려지면(현재가가 있을 때) 평단 없이 현재가만 담은 건물을 CTA 위에 먼저
 * 보여준다 — 문구만 있던 때보다 이 탭이 무엇을 그리는지 바로 보인다.
 */
export function PositionCta({
    symbol,
    low52w,
    high52w,
    lastClose,
    volumeByBand,
}: PositionCtaProps) {
    const t = useTranslations('widgets.portfolio-position');
    // 평단이 없으니 `avg: current`로 모델을 만든다 — `avg`는 양수 가드에만 쓰이고
    // 이 화면이 읽는 currentPos/currentClamped는 `current`만으로 정해진다
    // (`[symbol]/position/page.tsx`의 resolveCurrentPricePosition과 같은 근거).
    // 범위·현재가가 비었거나 퇴화 입력이면 null → 건물 없이 문구 CTA만.
    const model =
        low52w !== null && high52w !== null && lastClose !== null
            ? computePosition({
                  low52w,
                  high52w,
                  current: lastClose,
                  avg: lastClose,
              })
            : null;
    const showBuilding =
        model !== null &&
        low52w !== null &&
        high52w !== null &&
        lastClose !== null;
    const Building = volumeByBand
        ? PositionBuildingWithReadout
        : PositionBuilding;
    return (
        <section
            data-testid="position-cta"
            className="flex flex-col items-start gap-3 rounded-lg border border-secondary-700 bg-secondary-800/40 p-6"
        >
            {/* 평단 없이 현재가만 그린 건물 — 회원 건물과 같은 컴포넌트·같은 aria
                의미(role="img" + 요약 label)다. ★평단 자리는 아래 문구가 안내한다. */}
            {showBuilding && (
                <Building
                    symbol={symbol}
                    model={model}
                    low52w={low52w}
                    high52w={high52w}
                    current={lastClose}
                    avg={null}
                    volumeByBand={volumeByBand}
                    className="w-full"
                />
            )}
            <p className="text-sm font-semibold text-secondary-100">
                {t('PositionCta.019ed7')}
            </p>
            <p className="text-sm leading-relaxed text-secondary-400">
                {t('PositionCta.8df3cf')}
            </p>
            {low52w !== null && high52w !== null && (
                <p
                    data-testid="position-cta-range"
                    className="text-xs text-secondary-400 tabular-nums"
                >
                    {t('PositionCta.2bf3cd', {
                        v0: formatAmount(low52w, symbol),
                    })}{' '}
                    ~ {formatAmount(high52w, symbol)}
                </p>
            )}
            {/*
             * 심볼을 실어 보낸다. 예전에는 `href="/onboarding"` 리터럴이라
             * 클릭 의도가 첫 홉에서 사라졌다 — 보유종목 관리 화면은 물론이고 그 앞의
             * 로그인 화면조차 사용자가 어느 종목을 보다 왔는지 알지 못했다.
             */}
            <Link
                href={`/portfolio?symbol=${encodeURIComponent(symbol)}`}
                className={cn(BUTTON_PRIMARY, 'min-h-11 px-4 text-sm')}
            >
                {t('PositionCta.5edaf2')}
            </Link>
        </section>
    );
}
