// isE2E 결과를 테스트별로 제어하기 위해 vi.hoisted로 플래그 선언 (MISTAKES.md Tests §17)
const { e2eFlag } = vi.hoisted(() => {
    const e2eFlag = { value: false };
    return { e2eFlag };
});

vi.mock('@/shared/api/e2eEnv', () => ({
    isE2E: () => e2eFlag.value,
}));

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createE2EGatedSingleton } from '@/shared/api/fmp/createE2EGatedSingleton';

afterEach(() => {
    e2eFlag.value = false;
});

// 테스트 격리: 각 케이스마다 새로운 팩토리를 생성하므로 싱글턴 상태가 공유되지 않는다.

describe('createE2EGatedSingleton — prod 환경 (isE2E=false)', () => {
    beforeEach(() => {
        e2eFlag.value = false;
    });

    it('makeReal을 호출해 반환된 인스턴스를 돌려준다', () => {
        const realInstance = { type: 'real' };
        const makeReal = vi.fn(() => realInstance);
        const loadFake = vi.fn(() => ({ type: 'fake' }));

        const getProvider = createE2EGatedSingleton(makeReal, loadFake);
        const result = getProvider();

        expect(result).toBe(realInstance);
        expect(makeReal).toHaveBeenCalledTimes(1);
        expect(loadFake).not.toHaveBeenCalled();
    });

    it('두 번째 호출은 캐시를 반환하고 makeReal을 재호출하지 않는다 (싱글턴)', () => {
        const makeReal = vi.fn(() => ({ type: 'real' }));
        const loadFake = vi.fn(() => ({ type: 'fake' }));

        const getProvider = createE2EGatedSingleton(makeReal, loadFake);
        const first = getProvider();
        const second = getProvider();

        expect(second).toBe(first);
        expect(makeReal).toHaveBeenCalledTimes(1);
    });
});

describe('createE2EGatedSingleton — E2E 환경 (isE2E=true)', () => {
    beforeEach(() => {
        e2eFlag.value = true;
    });

    it('loadFake를 호출해 반환된 인스턴스를 돌려준다', () => {
        const fakeInstance = { type: 'fake' };
        const makeReal = vi.fn(() => ({ type: 'real' }));
        const loadFake = vi.fn(() => fakeInstance);

        const getProvider = createE2EGatedSingleton(makeReal, loadFake);
        const result = getProvider();

        expect(result).toBe(fakeInstance);
        expect(loadFake).toHaveBeenCalledTimes(1);
        expect(makeReal).not.toHaveBeenCalled();
    });

    it('두 번째 호출은 캐시를 반환하고 loadFake를 재호출하지 않는다 (싱글턴)', () => {
        const makeReal = vi.fn(() => ({ type: 'real' }));
        const loadFake = vi.fn(() => ({ type: 'fake' }));

        const getProvider = createE2EGatedSingleton(makeReal, loadFake);
        const first = getProvider();
        const second = getProvider();

        expect(second).toBe(first);
        expect(loadFake).toHaveBeenCalledTimes(1);
    });
});

describe('createE2EGatedSingleton — 독립 팩토리 간 싱글턴 격리', () => {
    it('서로 다른 팩토리 호출은 각자 독립적인 싱글턴을 가진다', () => {
        e2eFlag.value = false;

        const makeReal1 = vi.fn(() => ({ id: 1 }));
        const makeReal2 = vi.fn(() => ({ id: 2 }));

        const getProvider1 = createE2EGatedSingleton(makeReal1, vi.fn());
        const getProvider2 = createE2EGatedSingleton(makeReal2, vi.fn());

        expect(getProvider1()).not.toBe(getProvider2());
        expect(makeReal1).toHaveBeenCalledTimes(1);
        expect(makeReal2).toHaveBeenCalledTimes(1);
    });
});
