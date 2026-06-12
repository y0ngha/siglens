// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useIndicatorVisibility } from '../../hooks/useIndicatorVisibility';
import {
    FIRST_INDICATOR_PANE_INDEX,
    INACTIVE_PANE_INDEX,
    STORAGE_KEYS,
} from '../../constants';
import { INDICATOR_REGISTRY } from '../../model/indicatorRegistry';

describe('useIndicatorVisibility', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('starts with all pane indicators hidden (INACTIVE)', () => {
        const { result } = renderHook(() => useIndicatorVisibility());
        expect(result.current.visible.rsi).toBe(false);
        expect(result.current.visible.mfi).toBe(false);
        expect(result.current.paneIndices.rsi).toBe(INACTIVE_PANE_INDEX);
        expect(result.current.paneIndices.varianceRatio).toBe(
            INACTIVE_PANE_INDEX
        );
    });

    it('assigns compacted pane indices in registry order to active panes', () => {
        const { result } = renderHook(() => useIndicatorVisibility());
        act(() => result.current.toggle('rsi'));
        act(() => result.current.toggle('mfi'));
        act(() => result.current.toggle('hurst'));
        expect(result.current.paneIndices.rsi).toBe(FIRST_INDICATOR_PANE_INDEX);
        expect(result.current.paneIndices.mfi).toBe(
            FIRST_INDICATOR_PANE_INDEX + 1
        );
        expect(result.current.paneIndices.hurst).toBe(
            FIRST_INDICATOR_PANE_INDEX + 2
        );
        expect(result.current.paneIndices.macd).toBe(INACTIVE_PANE_INDEX);
    });

    it('toggle off reassigns indices (worst case: middle removed)', () => {
        const { result } = renderHook(() => useIndicatorVisibility());
        act(() => result.current.toggle('rsi'));
        act(() => result.current.toggle('macd'));
        act(() => result.current.toggle('cci'));
        act(() => result.current.toggle('macd'));
        expect(result.current.paneIndices.rsi).toBe(FIRST_INDICATOR_PANE_INDEX);
        expect(result.current.paneIndices.macd).toBe(INACTIVE_PANE_INDEX);
        expect(result.current.paneIndices.cci).toBe(
            FIRST_INDICATOR_PANE_INDEX + 1
        );
    });

    it('exposes a paneIndices entry for every pane indicator', () => {
        const { result } = renderHook(() => useIndicatorVisibility());
        const paneKeys = [
            'rsi',
            'macd',
            'dmi',
            'stochastic',
            'stochRsi',
            'cci',
            'mfi',
            'williamsR',
            'connorsRsi',
            'cmf',
            'bollingerPercentB',
            'hurst',
            'varianceRatio',
        ] as const;
        for (const k of paneKeys) {
            expect(result.current.paneIndices[k]).toBe(INACTIVE_PANE_INDEX);
        }
    });

    it('restores persisted visibility from localStorage on mount', () => {
        localStorage.setItem(
            STORAGE_KEYS.visible,
            JSON.stringify({ rsi: true })
        );
        const { result } = renderHook(() => useIndicatorVisibility());
        expect(result.current.visible.rsi).toBe(true);
        expect(result.current.paneIndices.rsi).toBe(FIRST_INDICATOR_PANE_INDEX);
    });

    it('fills missing registry keys with false when restoring a partial state', () => {
        // 레지스트리 성장 전 저장된 데이터처럼 일부 키만 있는 상황 — 신규 키가 누락되어도
        // 모든 등록 키가 boolean으로 채워져야 paneIndices 계산이 안전하다.
        localStorage.setItem(
            STORAGE_KEYS.visible,
            JSON.stringify({ rsi: true })
        );
        const { result } = renderHook(() => useIndicatorVisibility());
        // 저장값에 없던 키는 전부 false로 채워져야 한다(rsi=true는 위 별도 테스트가 검증).
        for (const indicator of INDICATOR_REGISTRY) {
            if (indicator.key === 'rsi') continue;
            expect(result.current.visible[indicator.key]).toBe(false);
        }
    });

    it('toggle works correctly after restoring from localStorage', () => {
        localStorage.setItem(
            STORAGE_KEYS.visible,
            JSON.stringify({ rsi: true })
        );
        const { result } = renderHook(() => useIndicatorVisibility());
        act(() => result.current.toggle('rsi'));
        expect(result.current.visible.rsi).toBe(false);
        expect(result.current.paneIndices.rsi).toBe(INACTIVE_PANE_INDEX);
    });

    it('persists visibility changes to localStorage', () => {
        const { result } = renderHook(() => useIndicatorVisibility());
        act(() => result.current.toggle('rsi'));
        const stored = JSON.parse(
            localStorage.getItem(STORAGE_KEYS.visible) ?? '{}'
        );
        expect(stored.rsi).toBe(true);
    });
});
