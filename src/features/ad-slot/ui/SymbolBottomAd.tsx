'use client';

import { useSymbolBottomAdSuppressed } from '@/features/ad-slot/model/SymbolBottomAdContext';
import { AdSlot } from '@/features/ad-slot/ui/AdSlot';
import { useHydrated } from '@/shared/hooks/useHydrated';

/**
 * `/[symbol]` 9개 탭이 함께 쓰는 하단 광고. 레이아웃에서 관련 종목 칩 **뒤**(푸터 앞)에 둔다 —
 * 다른 탭 카드와 종목 칩 사이에 끼우면 링크 묶음 사이라 실수 클릭을 부른다.
 *
 * 탭 화면이 억제 신호를 보내면(오류, 성능 저하 안내, 데이터 없는 탭, 보유 종목 없는 '내 위치') 렌더하지
 * 않는다.
 *
 * **하이드레이션 뒤에만 그린다.** 억제 신호는 effect로 등록돼 서버 렌더에는 반영되지 않는다. 서버
 * HTML에 상자를 그리면 억제 화면(오류·안내)에도 "광고" 상자가 실렸다가 빠진다. 하이드레이션 커밋에서
 * 억제 수가 먼저 확정되므로, 그다음 렌더에서 판정하면 상자가 잘못 그려지지 않는다. 페이지 맨 끝이라
 * 늦게 나타나도 첫 화면은 밀리지 않는다.
 *
 * 레이아웃이 유지되는 탭 이동에서는 광고를 다시 요청하지 않는다. 억제되는 탭을 거쳐 돌아오거나 종목이
 * 바뀌면 새 화면이라 새로 요청한다.
 */
export function SymbolBottomAd() {
    const isHydrated = useHydrated();
    const isSuppressed = useSymbolBottomAdSuppressed();
    if (!isHydrated || isSuppressed) return null;
    return <AdSlot placement="symbol-bottom" className="mx-4" />;
}
