import { renderHook, act, waitFor } from '@testing-library/react';
import type { ModelId } from '@y0ngha/siglens-core';
import { useSelectedModel } from '@/features/symbol-model/hooks/useSelectedModel';
import {
    LOCAL_STORAGE_ANALYSIS_MODEL_KEY,
    LOCAL_STORAGE_ANALYSIS_MODEL_MIGRATION_KEY,
} from '@/shared/lib/storageKeys';

// useSelectedModel transitively imports migrateLegacyAnalysisModel, which reads
// both the new and legacy defaults from core — the mock must export both.
vi.mock('@y0ngha/siglens-core', () => ({
    DEEPSEEK_V4_FLASH_MODEL: 'deepseek-v4-flash',
    GEMINI_2_5_FLASH_LITE_MODEL: 'gemini-2.5-flash-lite',
}));

const DEFAULT_MODEL = 'deepseek-v4-flash' as ModelId;
const PREMIUM_MODEL = 'gemini-2.5-pro' as ModelId;

describe('useSelectedModel', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('defaults to the default model', () => {
        const { result } = renderHook(() =>
            useSelectedModel([DEFAULT_MODEL, PREMIUM_MODEL], true)
        );

        expect(result.current[0]).toBe(DEFAULT_MODEL);
    });

    it('persists model selection to localStorage', () => {
        const { result } = renderHook(() =>
            useSelectedModel([DEFAULT_MODEL, PREMIUM_MODEL], true)
        );

        act(() => {
            result.current[1](PREMIUM_MODEL);
        });

        expect(localStorage.getItem(LOCAL_STORAGE_ANALYSIS_MODEL_KEY)).toBe(
            PREMIUM_MODEL
        );
        expect(result.current[0]).toBe(PREMIUM_MODEL);
    });

    it('reads stored model from localStorage after hydration', async () => {
        localStorage.setItem(LOCAL_STORAGE_ANALYSIS_MODEL_KEY, PREMIUM_MODEL);

        const { result } = renderHook(() =>
            useSelectedModel([DEFAULT_MODEL, PREMIUM_MODEL], true)
        );

        await waitFor(() => {
            expect(result.current[2]).toBe(true);
        });

        expect(result.current[0]).toBe(PREMIUM_MODEL);
    });

    it('falls back to default when stored model is not in allowed list', async () => {
        localStorage.setItem(
            LOCAL_STORAGE_ANALYSIS_MODEL_KEY,
            'obsolete-model'
        );

        const { result } = renderHook(() =>
            useSelectedModel([DEFAULT_MODEL, PREMIUM_MODEL], true)
        );

        await waitFor(() => {
            expect(result.current[2]).toBe(true);
        });

        expect(result.current[0]).toBe(DEFAULT_MODEL);
    });

    it('re-validates when allowedModels changes to exclude current model', async () => {
        const { result, rerender } = renderHook(
            ({ allowed }) => useSelectedModel(allowed, true),
            {
                initialProps: {
                    allowed: [
                        DEFAULT_MODEL,
                        PREMIUM_MODEL,
                    ] as readonly ModelId[],
                },
            }
        );

        act(() => {
            result.current[1](PREMIUM_MODEL);
        });

        expect(result.current[0]).toBe(PREMIUM_MODEL);

        rerender({ allowed: [DEFAULT_MODEL] as readonly ModelId[] });

        await waitFor(() => {
            expect(result.current[0]).toBe(DEFAULT_MODEL);
        });
    });

    it('waits for tier hydration before reading storage, then keeps the member-only stored model', async () => {
        // 회귀 가드: tier는 서버 왕복이라 마운트 직후엔 free 목록만 알 수 있다.
        // 그 시점에 저장값을 검증하면 member 전용 모델이 DEFAULT로 강등되고
        // (tier 확정 후 복원 경로가 없어) 회원 선택이 매 로드마다 사라졌다.
        localStorage.setItem(LOCAL_STORAGE_ANALYSIS_MODEL_KEY, PREMIUM_MODEL);

        const { result, rerender } = renderHook(
            ({ allowed, tierHydrated }) =>
                useSelectedModel(allowed, tierHydrated),
            {
                initialProps: {
                    // tier 미확정: free 목록만 보이는 상태
                    allowed: [DEFAULT_MODEL] as readonly ModelId[],
                    tierHydrated: false,
                },
            }
        );

        // tier 확정 전에는 읽지 않는다 — 아직 hydration 미완료.
        expect(result.current[2]).toBe(false);
        expect(result.current[0]).toBe(DEFAULT_MODEL);

        // tier가 member로 확정되어 허용 목록이 넓어진다.
        rerender({
            allowed: [DEFAULT_MODEL, PREMIUM_MODEL] as readonly ModelId[],
            tierHydrated: true,
        });

        await waitFor(() => {
            expect(result.current[2]).toBe(true);
        });
        expect(result.current[0]).toBe(PREMIUM_MODEL);
    });

    it('becomes hydrated after effect runs', async () => {
        const { result } = renderHook(() =>
            useSelectedModel([DEFAULT_MODEL], true)
        );

        await waitFor(() => {
            expect(result.current[2]).toBe(true);
        });
    });

    it('migrates a legacy-default (gemini-2.5-flash-lite) stored value to the new default on mount', async () => {
        // Legacy user: old analysis default stored, migration flag not yet set.
        localStorage.setItem(
            LOCAL_STORAGE_ANALYSIS_MODEL_KEY,
            'gemini-2.5-flash-lite'
        );
        expect(
            localStorage.getItem(LOCAL_STORAGE_ANALYSIS_MODEL_MIGRATION_KEY)
        ).toBeNull();

        const { result } = renderHook(() =>
            useSelectedModel([DEFAULT_MODEL, PREMIUM_MODEL], true)
        );

        await waitFor(() => {
            expect(result.current[2]).toBe(true);
        });

        // The mount-time migration rewrote the stored value, so the hook resolves
        // to the new DeepSeek default and the migration flag is now set.
        expect(result.current[0]).toBe(DEFAULT_MODEL);
        expect(localStorage.getItem(LOCAL_STORAGE_ANALYSIS_MODEL_KEY)).toBe(
            DEFAULT_MODEL
        );
        expect(
            localStorage.getItem(LOCAL_STORAGE_ANALYSIS_MODEL_MIGRATION_KEY)
        ).not.toBeNull();
    });
});
