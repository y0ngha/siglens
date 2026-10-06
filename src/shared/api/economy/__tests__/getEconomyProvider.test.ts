vi.mock('@/shared/api/e2eEnv');

import { vi, describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { MODULE_LOAD_TIMEOUT_MS } from '@/shared/test-utils/testTimeouts';

import { isE2E } from '@/shared/api/e2eEnv';

const mockIsE2E = vi.mocked(isE2E);

/**
 * 팩토리는 모듈 레벨 `cached`를 유지하므로 매 테스트마다 모듈을 다시 불러와
 * cached 상태를 reset해야 분기 검증이 결정적이 된다. 클래스 instanceof도 동일
 * fresh-import에서 가져온 클래스로 검증해야 vi.resetModules로 만들어진 새 클래스
 * 정의와 매치된다(top-level import는 stale 클래스를 참조).
 *
 * 참고: E2E 분기(`isE2E()===true`)는 `require()` runtime resolution에 의존하므로
 * vitest mock 캐시와 충돌해 직접 검증할 수 없다 — E2E_TEST 진입 자체는
 * Playwright E2E (e2e/specs/economy.spec.ts)가 결과 fixture로 검증한다.
 */
async function freshFactory() {
    vi.resetModules();
    const [{ getEconomyProvider }, { FmpEconomyProvider }] = await Promise.all([
        import('@/shared/api/economy/getEconomyProvider'),
        import('@/shared/api/fmp/FmpEconomyProvider'),
    ]);
    return { getEconomyProvider, FmpEconomyProvider };
}

describe('getEconomyProvider', () => {
    // 케이스마다 리셋 뒤 다시 적재하지만, 첫 적재의 변환·외부 의존 로드는 리셋과
    // 무관하게 남는다. 그 콜드 비용을 첫 케이스 본문이 아니라 여기서 치른다.
    beforeAll(async () => {
        await Promise.all([
            import('@/shared/api/economy/getEconomyProvider'),
            import('@/shared/api/fmp/FmpEconomyProvider'),
        ]);
    }, MODULE_LOAD_TIMEOUT_MS);

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('prod 환경(isE2E=false)일 때 FmpEconomyProvider 인스턴스 반환', async () => {
        mockIsE2E.mockReturnValue(false);
        const { getEconomyProvider, FmpEconomyProvider } = await freshFactory();
        expect(getEconomyProvider()).toBeInstanceOf(FmpEconomyProvider);
    });

    it('동일 모듈 인스턴스에서 두 번째 호출은 캐시된 동일 객체 반환 (요청 dedup)', async () => {
        mockIsE2E.mockReturnValue(false);
        const { getEconomyProvider } = await freshFactory();
        const a = getEconomyProvider();
        const b = getEconomyProvider();
        expect(a).toBe(b);
    });

    it('isE2E 호출은 한 번(첫 진입에서만 분기 결정 — 이후 캐시 hit)', async () => {
        mockIsE2E.mockReturnValue(false);
        const { getEconomyProvider } = await freshFactory();
        getEconomyProvider();
        getEconomyProvider();
        getEconomyProvider();
        expect(mockIsE2E).toHaveBeenCalledTimes(1);
    });
});
