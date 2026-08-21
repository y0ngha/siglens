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
    // 초기 스냅은 PEEK이다. HALF(0.55)로 열면 캔들·거래량 차트를 덮는다
    // (3개 기기 실측: 차트를 가리지 않는 최대 시트 점유율 0.194~0.215).
    //
    // 실제로 보이는 띠의 높이는 스냅 값 그대로가 아니다. 시트는 `h-[97svh]` 고정인데
    // vaul은 오프셋을 `(1 − snap) × window.innerHeight`로 잡으므로,
    //
    //     보이는 띠 = 0.97·svh − (1 − snap)·innerHeight
    //
    // 이고 두 단위가 일치할 때 **띠 = snap − PEEK_VISIBLE_OFFSET**으로 정리된다. SNAP_PEEK가
    // 0.15였을 때 실측값이 정확히 0.12로 나온 것이 이 식의 근거다.
    //
    // 그래서 0.20을 쓴다 — 띠는 0.17로 위 임계값(0.194) 아래에 머물면서,
    // svh/innerHeight 괴리에 대한 여유가 늘어난다. 괴리 1px당 띠는 (1 − snap)px씩
    // 줄어들므로, 띠가 0이 되는 지점이 0.141·svh에서 0.21·svh로 밀린다(약 50% 여유↑).
    // 이 여유가 여전히 중요한 이유는 두 가지다: (1) "AI 분석 중" 상태 배너가 이 띠
    // 안에 들어오는데, 분석이 진행 중임을 한눈에 알 수 있는 유일한 신호이고,
    // (2) 드래그로 시트를 확장하는 것이 여전히 주된, 가장 발견하기 쉬운 조작이며
    // — SymbolPageClient.tsx의 "AI 분석 보기" 버튼(setSheetSnap(SNAP_FULL))은
    // 그 대안일 뿐이다. 띠가 0에 완전히 수렴해 드래그로도 잡을 것이 없어지는
    // 파국적인 경우는 이제 그 버튼이 시트 밖(항상 보이는 타임프레임 바)에서
    // 커버한다.
    //
    // "AI 분석 중" 배너(36px)는 이 띠 안에 들어온다.
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
