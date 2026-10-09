// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    clearLastGate,
    readLastGate,
    rememberLastGate,
} from '@/shared/lib/funnel/lastGate';
import { LOCAL_STORAGE_FUNNEL_LAST_GATE_KEY } from '@/shared/lib/storageKeys';

describe('lastGate', () => {
    beforeEach(() => {
        window.localStorage.clear();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('키는 스펙 §3.3의 값이다', () => {
        expect(LOCAL_STORAGE_FUNNEL_LAST_GATE_KEY).toBe(
            'siglens:funnel:last-gate'
        );
    });

    it('기록한 값을 그대로 읽는다', () => {
        rememberLastGate('timeframe');
        expect(readLastGate()).toBe('timeframe');
        rememberLastGate('anon_auto');
        expect(readLastGate()).toBe('anon_auto');
    });

    it('없으면 null', () => {
        expect(readLastGate()).toBeNull();
    });

    it('카탈로그 밖의 저장값은 null로 읽는다 — 조작된 값이 DB에 들어가지 않는다', () => {
        window.localStorage.setItem(
            LOCAL_STORAGE_FUNNEL_LAST_GATE_KEY,
            '<script>'
        );
        expect(readLastGate()).toBeNull();
    });

    it('clearLastGate는 키를 지운다', () => {
        rememberLastGate('locked_detail');
        clearLastGate();
        expect(
            window.localStorage.getItem(LOCAL_STORAGE_FUNNEL_LAST_GATE_KEY)
        ).toBeNull();
    });

    it('저장소가 던져도 던지지 않는다', () => {
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('quota');
        });
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('blocked');
        });
        expect(() => rememberLastGate('model')).not.toThrow();
        expect(readLastGate()).toBeNull();
    });
});
