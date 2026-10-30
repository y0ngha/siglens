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

    // 저장된 사용자 데이터와의 호환을 위해 리터럴로 고정한다.
    it('저장 키는 리터럴로 고정된다 — 바뀌면 기존 사용자의 저장 선택이 사라진다', () => {
        expect(ANALYSIS_VIEW_STORAGE_KEY).toBe('siglens:analysis-view');
    });

    it('저장값이 없으면 기본값은 쉽게보기다', () => {
        const { result } = renderHook(() => useAnalysisView());

        expect(result.current[0]).toBe('plain');
    });

    it('저장된 원본보기를 복원한다', () => {
        localStorage.setItem(ANALYSIS_VIEW_STORAGE_KEY, '"raw"');

        const { result } = renderHook(() => useAnalysisView());

        expect(result.current[0]).toBe('raw');
    });

    it('알 수 없는 저장값은 쉽게보기로 돌아간다', () => {
        localStorage.setItem(ANALYSIS_VIEW_STORAGE_KEY, '"fancy"');

        const { result } = renderHook(() => useAnalysisView());

        expect(result.current[0]).toBe('plain');
    });

    it('선택한 모드를 localStorage에 기록한다', () => {
        const { result } = renderHook(() => useAnalysisView());

        act(() => {
            result.current[1]('raw');
        });

        expect(result.current[0]).toBe('raw');
        expect(localStorage.getItem(ANALYSIS_VIEW_STORAGE_KEY)).toBe('"raw"');
    });
});
