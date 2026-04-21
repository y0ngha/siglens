'use client';

import {
    type Dispatch,
    type ReactNode,
    type SetStateAction,
    useState,
} from 'react';
import {
    SNAP_HALF,
    type SnapPoint,
} from '@/components/symbol-page/constants/mobileSheet';

interface UseMobileSheetReturn {
    sheetSnap: SnapPoint;
    setSheetSnap: Dispatch<SetStateAction<SnapPoint>>;
    mobileSheetContent: ReactNode;
    setMobileSheetContent: Dispatch<SetStateAction<ReactNode>>;
}

export function useMobileSheet(): UseMobileSheetReturn {
    const [sheetSnap, setSheetSnap] = useState<SnapPoint>(SNAP_HALF);
    const [mobileSheetContent, setMobileSheetContent] =
        useState<ReactNode>(null);

    return {
        sheetSnap,
        setSheetSnap,
        mobileSheetContent,
        setMobileSheetContent,
    };
}
