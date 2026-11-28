import type { ReactNode } from 'react';
import { SuppressSymbolBottomAd } from '@/features/ad-slot/model/SymbolBottomAdContext';

/**
 * '내 위치' 탭에서 보유 카드가 아닌 화면(로딩, 비로그인·보유 없음 안내, 데이터 부족)을 감싸
 * 레이아웃 공통 하단 광고를 끈다. 이 탭의 본체는 보유 종목이 있는 회원에게만 그려지고, 나머지
 * 화면은 템플릿 문장뿐이라 광고를 둘 내용이 없다(AdSense "내용 없는 화면" 금지).
 */
export function WithoutBottomAd({
    children,
}: {
    readonly children: ReactNode;
}) {
    return (
        <>
            <SuppressSymbolBottomAd />
            {children}
        </>
    );
}
