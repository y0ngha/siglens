'use client';

import {
    startTransition,
    useCallback,
    useEffect,
    useEffectEvent,
    useRef,
    useState,
} from 'react';
import type { ModelId } from '@y0ngha/siglens-core';
import { DEFAULT_ANALYSIS_MODEL } from '@/shared/config/analysisDefaultModel';
import {
    migrateLegacyAnalysisModel,
    migrateRetiredAnalysisModel,
} from '../lib/migrateAnalysisModel';
import { pickFallbackModel } from '../lib/pickFallbackModel';
import { readStoredModel, writeStoredModel } from '../lib/storedAnalysisModel';

/**
 * 선택된 분석 모델 상태 — localStorage 영속 + tier 허용 목록 검증.
 *
 * `isTierHydrated`가 필수인 이유: tier는 서버 왕복(`useUserTier`)이라 마운트 직후엔
 * 항상 `DEFAULT_TIER='free'`다. 그 시점에 저장값을 검증하면 member/pro 전용 모델
 * (claude-sonnet-5-5 등)이 허용 목록 밖으로 판정돼 기본 모델로 강등되고, tier가
 * 확정돼 목록이 넓어져도 복원 경로가 없어(재검증은 좁힐 때만 동작) 회원의 선택이
 * 매 로드마다 조용히 사라진다. 그래서 읽기·재검증 둘 다 tier 확정까지 미룬다.
 *
 * 반환은 `[선택된 모델, 선택 setter(저장 포함, 안정 참조), 저장값을 읽었는지]`다.
 */
export function useSelectedModel(
    allowedModels: readonly ModelId[],
    isTierHydrated: boolean
): [ModelId, (m: ModelId) => void, boolean] {
    const [selectedModel, setSelectedModelState] = useState<ModelId>(
        DEFAULT_ANALYSIS_MODEL
    );
    const [isHydrated, setIsHydrated] = useState(false);
    // 저장값 읽기를 tier 확정 후 1회로 고정한다. tier가 나중에 다시 바뀌어도
    // (로그아웃 등) 사용자의 현재 선택을 저장값으로 되돌리지 않기 위한 가드.
    const hasReadRef = useRef(false);

    const setSelectedModel = useCallback((model: ModelId): void => {
        writeStoredModel(model);
        setSelectedModelState(model);
    }, []);

    const readFromStorage = useEffectEvent((): void => {
        if (typeof window === 'undefined') return;
        // Run the one-time legacy-default migration BEFORE reading, so the read
        // below picks up the migrated value for users still on gemini-2.5-flash-lite.
        migrateLegacyAnalysisModel();
        // A retired model would fail the allowlist and drop to the default;
        // move it to its successor first (gemini-3.7-flash → 3.8-flash).
        migrateRetiredAnalysisModel();
        const stored = readStoredModel();
        const resolved =
            stored !== null && allowedModels.includes(stored)
                ? stored
                : pickFallbackModel(allowedModels);
        startTransition(() => {
            setSelectedModelState(resolved);
            setIsHydrated(true);
        });
    });

    useEffect(() => {
        if (!isTierHydrated || hasReadRef.current) return;
        hasReadRef.current = true;
        // localStorage(외부 시스템)를 티어 하이드레이션 뒤 한 번 읽어 이 훅의 로컬 상태를 채운다. 부모로 올리는 데이터가 아니다.
        // react-doctor-disable-next-line react-doctor/no-pass-data-to-parent
        readFromStorage();
    }, [isTierHydrated]);

    // 허용 목록이 바뀌면(로그인·로그아웃, 꺼진 모델 목록 갱신) 선택을 다시 검증한다.
    // 저장값을 읽기 전(`isHydrated` false)에는 건너뛴다: 읽기 effect와 같은 커밋에서 돌면
    // 아직 초기값(기본 모델)인 선택을 보고 폴백을 예약해, 방금 읽은 저장값을 덮어쓴다.
    // 기본 모델이 고를 수 있는 목록에 없을 때(운영자가 꺼 둔 경우) 회원의 선택이 사라진다.
    useEffect(() => {
        if (!isTierHydrated || !isHydrated) return;
        if (
            allowedModels.length > 0 &&
            // 티어가 비동기로 하이드레이션·변경되므로 허용 모델 목록 변화에 맞춰 선택을 폴백시킨다. 부모 전달이 아니라 이 훅 내부 보정이다.
            // react-doctor-disable-next-line react-doctor/no-pass-live-state-to-parent
            !allowedModels.includes(selectedModel)
        ) {
            const fallback = pickFallbackModel(allowedModels);
            startTransition(() => setSelectedModelState(fallback));
        }
    }, [allowedModels, selectedModel, isTierHydrated, isHydrated]);

    return [selectedModel, setSelectedModel, isHydrated];
}
