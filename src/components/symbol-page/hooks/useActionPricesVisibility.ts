'use client';

import { type Dispatch, type SetStateAction, useState } from 'react';

interface UseActionPricesVisibilityReturn {
    actionPricesVisible: boolean;
    setActionPricesVisible: Dispatch<SetStateAction<boolean>>;
}

export function useActionPricesVisibility(): UseActionPricesVisibilityReturn {
    const [actionPricesVisible, setActionPricesVisible] = useState(true);
    return { actionPricesVisible, setActionPricesVisible };
}
