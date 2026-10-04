/**
 * Branch coverage tests for useSelectedModel — targets uncovered:
 * - L26: window undefined check in setSelectedModel
 * - L33: window undefined check in readFromStorage
 * - L57: DEFAULT_MODEL not in allowedModels fallback
 * - L59: allowedModels[0] ?? DEFAULT_MODEL fallback
 */

import { renderHook, act } from '@testing-library/react';
import { useSelectedModel } from '@/features/symbol-model/hooks/useSelectedModel';
import { LOCAL_STORAGE_ANALYSIS_MODEL_KEY } from '@/shared/lib/storageKeys';
import type { ModelId } from '@y0ngha/siglens-core';

describe('useSelectedModel — branch coverage', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('hydrates from localStorage with stored allowed model', async () => {
        localStorage.setItem(
            LOCAL_STORAGE_ANALYSIS_MODEL_KEY,
            'gemini-3.6-flash'
        );

        // Includes DEEPSEEK_V4_1_FLASH_MODEL (the real DEFAULT_MODEL) so the mount-time
        // re-validate effect (L52-61) doesn't race the hydration effect and clobber it —
        // matches production, where tier restrictions are disabled and every model
        // (including the default) is always in allowedModels.
        const allowedModels: ModelId[] = [
            'deepseek-v4.1-flash',
            'gemini-3.5-flash-lite',
            'gemini-3.6-flash',
        ];
        const { result } = renderHook(() =>
            useSelectedModel(allowedModels, true)
        );

        // Wait for hydration effect
        await act(async () => {});

        expect(result.current[0]).toBe('gemini-3.6-flash');
        expect(result.current[2]).toBe(true); // isHydrated
    });

    it('falls back to DEFAULT_MODEL when stored model is not in allowedModels', async () => {
        localStorage.setItem(LOCAL_STORAGE_ANALYSIS_MODEL_KEY, 'unknown-model');

        const allowedModels: ModelId[] = [
            'deepseek-v4.1-flash',
            'gemini-3.5-flash-lite',
            'gemini-3.6-flash',
        ];
        const { result } = renderHook(() =>
            useSelectedModel(allowedModels, true)
        );

        await act(async () => {});

        expect(result.current[0]).toBe('deepseek-v4.1-flash');
    });

    it('setSelectedModel persists to localStorage', () => {
        const allowedModels: ModelId[] = [
            'gemini-3.5-flash-lite',
            'gemini-3.6-flash',
        ];
        const { result } = renderHook(() =>
            useSelectedModel(allowedModels, true)
        );

        act(() => {
            result.current[1]('gemini-3.6-flash');
        });

        expect(localStorage.getItem(LOCAL_STORAGE_ANALYSIS_MODEL_KEY)).toBe(
            'gemini-3.6-flash'
        );
        expect(result.current[0]).toBe('gemini-3.6-flash');
    });

    it('re-validates when allowedModels changes and current model is not allowed', async () => {
        const { result, rerender } = renderHook(
            ({ allowed }: { allowed: ModelId[] }) =>
                useSelectedModel(allowed, true),
            {
                initialProps: {
                    allowed: [
                        'gemini-3.5-flash-lite',
                        'gemini-3.6-flash',
                    ] as ModelId[],
                },
            }
        );

        await act(async () => {});

        // Change to select a model
        act(() => {
            result.current[1]('gemini-3.6-flash');
        });

        expect(result.current[0]).toBe('gemini-3.6-flash');

        // Now change allowedModels to exclude the selected model
        await act(async () => {
            rerender({
                allowed: ['gemini-3.5-flash-lite'] as ModelId[],
            });
        });

        // DEFAULT_MODEL (deepseek-v4.1-flash) is not in the new allowedModels either,
        // so this falls through to allowedModels[0] (L59), not DEFAULT_MODEL (L57).
        expect(result.current[0]).toBe('gemini-3.5-flash-lite');
    });

    it('falls back to first allowed model when DEFAULT_MODEL is not in allowedModels', async () => {
        const { result, rerender } = renderHook(
            ({ allowed }: { allowed: ModelId[] }) =>
                useSelectedModel(allowed, true),
            {
                initialProps: {
                    allowed: [
                        'gemini-3.5-flash-lite',
                        'gemini-3.6-flash',
                    ] as ModelId[],
                },
            }
        );

        await act(async () => {});

        act(() => {
            result.current[1]('gemini-3.6-flash');
        });

        // Change allowedModels to exclude both selected AND default model
        await act(async () => {
            rerender({
                allowed: ['claude-haiku-4-5'] as ModelId[],
            });
        });

        // Should fall back to allowedModels[0]
        expect(result.current[0]).toBe('claude-haiku-4-5');
    });
});
