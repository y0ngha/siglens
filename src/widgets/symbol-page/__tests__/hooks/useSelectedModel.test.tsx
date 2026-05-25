import { renderHook, act, waitFor } from '@testing-library/react';
import type { ModelId } from '@y0ngha/siglens-core';
import { useSelectedModel } from '@/widgets/symbol-page/hooks/useSelectedModel';
import { LOCAL_STORAGE_ANALYSIS_MODEL_KEY } from '@/shared/lib/storageKeys';

vi.mock('@y0ngha/siglens-core', () => ({
    GEMINI_2_5_FLASH_LITE_MODEL: 'gemini-2.5-flash-lite',
}));

const DEFAULT_MODEL = 'gemini-2.5-flash-lite' as ModelId;
const PREMIUM_MODEL = 'gemini-2.5-pro' as ModelId;

describe('useSelectedModel', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('defaults to the default model', () => {
        const { result } = renderHook(() =>
            useSelectedModel([DEFAULT_MODEL, PREMIUM_MODEL])
        );

        expect(result.current[0]).toBe(DEFAULT_MODEL);
    });

    it('persists model selection to localStorage', () => {
        const { result } = renderHook(() =>
            useSelectedModel([DEFAULT_MODEL, PREMIUM_MODEL])
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
            useSelectedModel([DEFAULT_MODEL, PREMIUM_MODEL])
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
            useSelectedModel([DEFAULT_MODEL, PREMIUM_MODEL])
        );

        await waitFor(() => {
            expect(result.current[2]).toBe(true);
        });

        expect(result.current[0]).toBe(DEFAULT_MODEL);
    });

    it('re-validates when allowedModels changes to exclude current model', async () => {
        const { result, rerender } = renderHook(
            ({ allowed }) => useSelectedModel(allowed),
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

    it('becomes hydrated after effect runs', async () => {
        const { result } = renderHook(() => useSelectedModel([DEFAULT_MODEL]));

        await waitFor(() => {
            expect(result.current[2]).toBe(true);
        });
    });
});
