// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import {
    ANALYSIS_VIEW_STORAGE_KEY,
    useAnalysisView,
} from '@/shared/model/analysisView';

describe('useAnalysisView', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('persists under the literal storage key', () => {
        expect(ANALYSIS_VIEW_STORAGE_KEY).toBe('siglens:analysis-view');
    });

    it('defaults to plain when nothing is stored', () => {
        const { result } = renderHook(() => useAnalysisView());

        expect(result.current[0]).toBe('plain');
    });

    it('restores a stored raw mode', () => {
        localStorage.setItem(ANALYSIS_VIEW_STORAGE_KEY, '"raw"');

        const { result } = renderHook(() => useAnalysisView());

        expect(result.current[0]).toBe('raw');
    });

    it('falls back to plain for an unknown stored value', () => {
        localStorage.setItem(ANALYSIS_VIEW_STORAGE_KEY, '"fancy"');

        const { result } = renderHook(() => useAnalysisView());

        expect(result.current[0]).toBe('plain');
    });

    it('writes the chosen mode to localStorage', () => {
        const { result } = renderHook(() => useAnalysisView());

        act(() => {
            result.current[1]('raw');
        });

        expect(result.current[0]).toBe('raw');
        expect(localStorage.getItem(ANALYSIS_VIEW_STORAGE_KEY)).toBe('"raw"');
    });
});
