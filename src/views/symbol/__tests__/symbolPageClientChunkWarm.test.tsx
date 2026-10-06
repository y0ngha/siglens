import {
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';
import { MODULE_LOAD_TIMEOUT_MS } from '@/shared/test-utils/testTimeouts';

/**
 * `SymbolPageClient` 모듈 최상위의 **시트 청크 선인출** 가드 3분기를 고정한다.
 *
 * 이 코드는 컴포넌트 밖에서 실행되므로 여기서 throw하면 모듈 평가가 실패해 페이지
 * 전체가 죽는다. 실제로 `matchMedia` 존재 확인이 없던 초안이 jsdom에서 모듈 로드
 * 단계를 깨뜨려 기존 테스트 61건을 무너뜨렸다. 그 가드가 조용히 사라지거나 모바일
 * 판정이 뒤집혀도 다른 테스트는 빨개지지 않으므로, 분기 자체를 직접 단언한다.
 *
 * 모듈 최상위 코드는 import 시 **한 번만** 평가되므로 매 케이스마다
 * `vi.resetModules()`로 모듈 레지스트리를 비운 뒤 다시 import한다.
 */
describe('SymbolPageClient — 시트 청크 선인출 가드', () => {
    const originalMatchMedia = globalThis.window?.matchMedia;

    /**
     * 콜드 적재를 케이스 밖으로 뺀다. 그래프 전체(+ 모바일 케이스의 워밍이 당기는
     * 시트 청크)를 한 번 변환·적재해 두면, 이후 `resetModules`는 **평가만** 다시
     * 한다 — 변환 결과와 외부(node_modules) 의존은 레지스트리 리셋과 무관하게
     * 남는다. 이 적재는 `matchMedia`가 있는 기본 환경에서 일어나지만, 각 케이스는
     * 여전히 리셋 뒤 자기 환경에서 모듈 최상위를 새로 평가하므로 단언은 그대로다.
     * 예전엔 이 콜드 비용을 첫 케이스가 본문에서 치러, 병렬 전체 실행에서 30초
     * 상한마저 넘겼다(2026-10-06). 뺀 뒤엔 케이스 본문(리셋 뒤 재평가)이 0.2초
     * 남짓이라 본문은 기본 타임아웃을 그대로 쓴다.
     */
    beforeAll(async () => {
        await import('@/views/symbol/SymbolPageClient');
        await import('@/views/symbol/MobileAnalysisSheet');
    }, MODULE_LOAD_TIMEOUT_MS);

    beforeEach(() => {
        vi.resetModules();
    });

    afterEach(() => {
        if (originalMatchMedia === undefined) {
            Reflect.deleteProperty(window, 'matchMedia');
        } else {
            window.matchMedia = originalMatchMedia;
        }
        vi.restoreAllMocks();
    });

    /** 모바일 폭 여부를 답하는 matchMedia 스텁. 호출된 쿼리를 기록한다. */
    function stubMatchMedia(matches: boolean): string[] {
        const queries: string[] = [];
        window.matchMedia = ((query: string) => {
            queries.push(query);
            return {
                matches,
                media: query,
                addEventListener: () => {},
                removeEventListener: () => {},
            };
        }) as unknown as typeof window.matchMedia;
        return queries;
    }

    it('matchMedia가 없으면 모듈 평가가 throw하지 않는다', async () => {
        // jsdom 기본 환경이 이 상태다. 여기서 터지면 페이지 전체가 죽는다.
        Reflect.deleteProperty(window, 'matchMedia');
        await expect(
            import('@/views/symbol/SymbolPageClient')
        ).resolves.toBeDefined();
    });

    it('모바일 폭이면 모바일 미디어 쿼리로 판정한다', async () => {
        const queries = stubMatchMedia(true);
        const { MOBILE_VIEWPORT_MEDIA_QUERY } =
            await import('@/shared/config/viewport');

        await import('@/views/symbol/SymbolPageClient');

        // 워밍 자체(동적 import)는 부수효과라 직접 단언하지 않는다 — 대신 판정에
        // 쓰인 쿼리가 실제 모바일 브레이크포인트인지를 고정한다. 이 값이 어긋나면
        // 데스크톱에서 불필요한 청크를 받거나 모바일에서 워밍이 아예 안 돈다.
        expect(queries).toContain(MOBILE_VIEWPORT_MEDIA_QUERY);
    });

    it('데스크톱 폭에서도 모듈 평가가 throw하지 않는다', async () => {
        stubMatchMedia(false);
        await expect(
            import('@/views/symbol/SymbolPageClient')
        ).resolves.toBeDefined();
    });
});
