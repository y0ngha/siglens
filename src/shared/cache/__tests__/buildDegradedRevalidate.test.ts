const { pinMock } = vi.hoisted(() => ({ pinMock: vi.fn(async () => true) }));
vi.mock('next/cache', () => ({
    unstable_cache: vi.fn(() => pinMock),
}));

import { unstable_cache } from 'next/cache';
import {
    BUILD_DEGRADED_REVALIDATE_SECONDS,
    shortenRevalidateForBuildDegrade,
    shortenRevalidateIfDatabaseMissingAtBuild,
    shortenRevalidateIfFmpFailedAtBuild,
} from '@/shared/cache/buildDegradedRevalidate';
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
        expect(BUILD_DEGRADED_REVALIDATE_SECONDS).toBe(60);
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

describe('shortenRevalidateForBuildDegrade', () => {
    beforeEach(() => {
        pinMock.mockClear();
        __resetFmpBuildBreakerForTests();
    });

    it('FMP 상태와 무관하게 래퍼를 호출해 이 렌더의 revalidate를 낮춘다', async () => {
        await shortenRevalidateForBuildDegrade();
        expect(pinMock).toHaveBeenCalledOnce();
    });
});

describe('shortenRevalidateIfDatabaseMissingAtBuild', () => {
    beforeEach(() => {
        pinMock.mockClear();
        vi.stubEnv('SIGLENS_OFFLINE_BUILD', '');
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('빌드 단계에 DB가 없으면 래퍼를 호출한다', async () => {
        vi.stubEnv('NEXT_PHASE', 'phase-production-build');
        vi.stubEnv('DATABASE_URL', '');

        await shortenRevalidateIfDatabaseMissingAtBuild();
        expect(pinMock).toHaveBeenCalledOnce();
    });

    it('오프라인 빌드(URL이 있어도 Neon 차단)면 래퍼를 호출한다', async () => {
        vi.stubEnv('NEXT_PHASE', 'phase-production-build');
        vi.stubEnv('DATABASE_URL', 'postgres://localhost:5432/testdb');
        vi.stubEnv('SIGLENS_OFFLINE_BUILD', '1');

        await shortenRevalidateIfDatabaseMissingAtBuild();
        expect(pinMock).toHaveBeenCalledOnce();
    });

    it('DB가 있는 빌드에서는 아무것도 하지 않는다', async () => {
        vi.stubEnv('NEXT_PHASE', 'phase-production-build');
        vi.stubEnv('DATABASE_URL', 'postgres://localhost:5432/testdb');

        await shortenRevalidateIfDatabaseMissingAtBuild();
        expect(pinMock).not.toHaveBeenCalled();
    });

    it('런타임에서는 DB가 없어도 아무것도 하지 않는다', async () => {
        vi.stubEnv('NEXT_PHASE', '');
        vi.stubEnv('DATABASE_URL', '');

        await shortenRevalidateIfDatabaseMissingAtBuild();
        expect(pinMock).not.toHaveBeenCalled();
    });
});
