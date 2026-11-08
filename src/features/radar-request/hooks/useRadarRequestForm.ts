'use client';

import { useActionState } from 'react';
import { submitRadarRequestAction } from '@/entities/inquiry/actions/submitRadarRequestAction';
import type { RadarRequestFormState } from '@/entities/inquiry/lib/types';

const INITIAL_STATE: RadarRequestFormState = {
    submitted: false,
    error: null,
    values: { symbol: '', email: '' },
};

type UseRadarRequestFormReturn = ReturnType<
    typeof useActionState<RadarRequestFormState, FormData>
>;

/**
 * 종목 요청 폼의 `useActionState` 연결 — `[state, formAction, isPending]`을 그대로 돌려준다.
 * 실패 시 `state.values`에 사용자가 보낸 값이 실려 와 비제어 입력의 기본값으로 쓰인다.
 */
export function useRadarRequestForm(): UseRadarRequestFormReturn {
    return useActionState<RadarRequestFormState, FormData>(
        submitRadarRequestAction,
        INITIAL_STATE
    );
}
