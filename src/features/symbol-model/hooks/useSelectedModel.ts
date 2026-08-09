'use client';

import {
    startTransition,
    useCallback,
    useEffect,
    useEffectEvent,
    useRef,
    useState,
} from 'react';
import { DEEPSEEK_V4_FLASH_MODEL, type ModelId } from '@y0ngha/siglens-core';
import { LOCAL_STORAGE_ANALYSIS_MODEL_KEY } from '@/shared/lib/storageKeys';
import { migrateLegacyAnalysisModel } from '../lib/migrateAnalysisModel';

const DEFAULT_MODEL: ModelId = DEEPSEEK_V4_FLASH_MODEL;

/**
 * 선택된 분석 모델 상태 — localStorage 영속 + tier 허용 목록 검증.
 *
 * `isTierHydrated`가 필수인 이유: tier는 서버 왕복(`useUserTier`)이라 마운트 직후엔
 * 항상 `DEFAULT_TIER='free'`다. 그 시점에 저장값을 검증하면 member/pro 전용 모델
 * (claude-sonnet-5 등)이 허용 목록 밖으로 판정돼 DEFAULT_MODEL로 강등되고, tier가
 * 확정돼 목록이 넓어져도 복원 경로가 없어(재검증은 좁힐 때만 동작) 회원의 선택이
 * 매 로드마다 조용히 사라진다. 그래서 읽기·재검증 둘 다 tier 확정까지 미룬다.
 */
export function useSelectedModel(
    allowedModels: readonly ModelId[],
    isTierHydrated: boolean
): [ModelId, (m: ModelId) => void, boolean] {
    const [selectedModel, setSelectedModelState] =
        useState<ModelId>(DEFAULT_MODEL);
    const [isHydrated, setIsHydrated] = useState(false);
    // 저장값 읽기를 tier 확정 후 1회로 고정한다. tier가 나중에 다시 바뀌어도
    // (로그아웃 등) 사용자의 현재 선택을 저장값으로 되돌리지 않기 위한 가드.
    const hasReadRef = useRef(false);

    const setSelectedModel = useCallback((model: ModelId): void => {
        if (typeof window !== 'undefined') {
            localStorage.setItem(LOCAL_STORAGE_ANALYSIS_MODEL_KEY, model);
        }
        setSelectedModelState(model);
    }, []);

    const readFromStorage = useEffectEvent((): void => {
        if (typeof window === 'undefined') return;
        // Run the one-time legacy-default migration BEFORE reading, so the read
        // below picks up the migrated value for users still on gemini-2.5-flash-lite.
        migrateLegacyAnalysisModel();
        const stored = localStorage.getItem(
            LOCAL_STORAGE_ANALYSIS_MODEL_KEY
        ) as ModelId | null;
        const resolved =
            stored !== null && allowedModels.includes(stored)
                ? stored
                : DEFAULT_MODEL;
        startTransition(() => {
            setSelectedModelState(resolved);
            setIsHydrated(true);
        });
    });

    useEffect(() => {
        if (!isTierHydrated || hasReadRef.current) return;
        hasReadRef.current = true;
        readFromStorage();
    }, [isTierHydrated]);

    // Re-validate when tier changes (e.g., user logs in/out)
    useEffect(() => {
        if (!isTierHydrated) return;
        if (
            allowedModels.length > 0 &&
            !allowedModels.includes(selectedModel)
        ) {
            const fallback = allowedModels.includes(DEFAULT_MODEL)
                ? DEFAULT_MODEL
                : (allowedModels[0] ?? DEFAULT_MODEL);
            startTransition(() => setSelectedModelState(fallback));
        }
    }, [allowedModels, selectedModel, isTierHydrated]);

    return [selectedModel, setSelectedModel, isHydrated];
}
