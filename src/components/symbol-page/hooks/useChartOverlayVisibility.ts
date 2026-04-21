'use client';

import { useState, type Dispatch, type SetStateAction } from 'react';

interface UseChartOverlayVisibilityReturn {
    actionPricesVisible: boolean;
    setActionPricesVisible: Dispatch<SetStateAction<boolean>>;
}

export function useChartOverlayVisibility(): UseChartOverlayVisibilityReturn {
    const [actionPricesVisible, setActionPricesVisible] = useState(true);
    return { actionPricesVisible, setActionPricesVisible };
}
