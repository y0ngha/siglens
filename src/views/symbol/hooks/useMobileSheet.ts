'use client';

import {
    type Dispatch,
    type ReactNode,
    type SetStateAction,
    useState,
} from 'react';
import { SNAP_PEEK, type SnapPoint } from '../constants/mobileSheet';

interface UseMobileSheetReturn {
    sheetSnap: SnapPoint;
    setSheetSnap: Dispatch<SetStateAction<SnapPoint>>;
    mobileSheetContent: ReactNode;
    setMobileSheetContent: Dispatch<SetStateAction<ReactNode>>;
}

export function useMobileSheet(): UseMobileSheetReturn {
    // 초기 스냅은 PEEK이다. HALF로 열면 캔들·거래량 차트를 덮는데(3개 기기 실측:
    // 측정된 커버리지 임계값 아래로 유지되는 최대 시트 비율 0.194~0.215), ChartContent는
    // 하단 패딩을 SNAP_PEEK 높이만큼만 예약하므로 정합도 깨진다. 단, 이 예약은
    // vaul의 스냅 오프셋 계산 기준인 window.innerHeight를 사용하고 ChartContent는
    // svh 단위로 패딩을 잡으므로, 툴바가 접혀 innerHeight ≈ lvh > svh가 되는
    // 모바일 Safari 등에서는 예약분이 실측보다 몇 px 부족할 수 있다(svh/lvh 괴리).
    // PEEK에서도 "AI 분석 중" 배너(36px)는 가시 영역(85~126px) 안에 들어오므로
    // HALF의 원래 목적은 유지된다.
    const [sheetSnap, setSheetSnap] = useState<SnapPoint>(SNAP_PEEK);
    const [mobileSheetContent, setMobileSheetContent] =
        useState<ReactNode>(null);

    return {
        sheetSnap,
        setSheetSnap,
        mobileSheetContent,
        setMobileSheetContent,
    };
}
