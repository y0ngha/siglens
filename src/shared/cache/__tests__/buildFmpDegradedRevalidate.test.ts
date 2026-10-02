const { pinMock } = vi.hoisted(() => ({ pinMock: vi.fn(async () => true) }));
vi.mock('next/cache', () => ({
    unstable_cache: vi.fn(() => pinMock),
}));

import { unstable_cache } from 'next/cache';
import {
    BUILD_FMP_DEGRADED_REVALIDATE_SECONDS,
    shortenRevalidateIfFmpFailedAtBuild,
} from '@/shared/cache/buildFmpDegradedRevalidate';
import {
    __resetFmpBuildBreakerForTests,
    tripFmpBuildBreaker,
} from '@/shared/api/offlineBuild';

describe('shortenRevalidateIfFmpFailedAtBuild', () => {
    // 모듈 로드 시점에 한 번 만들어지는 래퍼 — clearAllMocks 전에 캡처한다.
    const wrapperOptions = vi.mocked(unstable_cache).mock.calls.at(-1)?.[2];

    beforeEach(() => {
        pinMock.mockClear();
        __resetFmpBuildBreakerForTests();
        vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    });

    afterEach(() => {
        __resetFmpBuildBreakerForTests();
        vi.unstubAllEnvs();
        vi.restoreAllMocks();
    });

    it('60초 revalidate의 unstable_cache 래퍼로 렌더 revalidate를 낮춘다', () => {
        expect(BUILD_FMP_DEGRADED_REVALIDATE_SECONDS).toBe(60);
        expect(wrapperOptions).toEqual({ revalidate: 60 });
    });

    it('빌드 중 회로가 열렸으면 래퍼를 호출한다', async () => {
        vi.stubEnv('NEXT_PHASE', 'phase-production-build');
        tripFmpBuildBreaker('quote', new Error('429'));

        await shortenRevalidateIfFmpFailedAtBuild();
        expect(pinMock).toHaveBeenCalledOnce();
    });

    it('FMP_AT_BUILD=off 빌드면 래퍼를 호출한다', async () => {
        vi.stubEnv('NEXT_PHASE', 'phase-production-build');
        vi.stubEnv('FMP_AT_BUILD', 'off');

        await shortenRevalidateIfFmpFailedAtBuild();
        expect(pinMock).toHaveBeenCalledOnce();
    });

    it('정상 빌드(회로 닫힘)에서는 아무것도 하지 않는다', async () => {
        vi.stubEnv('NEXT_PHASE', 'phase-production-build');

        await shortenRevalidateIfFmpFailedAtBuild();
        expect(pinMock).not.toHaveBeenCalled();
    });

    it('런타임에서는 off 설정이어도 아무것도 하지 않는다', async () => {
        vi.stubEnv('NEXT_PHASE', '');
        vi.stubEnv('FMP_AT_BUILD', 'off');

        await shortenRevalidateIfFmpFailedAtBuild();
        expect(pinMock).not.toHaveBeenCalled();
    });
});
