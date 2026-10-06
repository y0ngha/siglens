const { pinMock } = vi.hoisted(() => ({ pinMock: vi.fn(async () => true) }));
vi.mock('next/cache', () => ({
    unstable_cache: vi.fn(() => pinMock),
}));

import { unstable_cache } from 'next/cache';
import {
    BUILD_DEGRADED_REVALIDATE_SECONDS,
    INCOMPLETE_SESSION_REVALIDATE_SECONDS,
    RUNTIME_DEGRADED_REVALIDATE_SECONDS,
    shortenRevalidateForIncompleteSession,
    shortenRevalidateForRuntimeDegrade,
    shortenRevalidateForBuildDegrade,
    shortenRevalidateIfDatabaseMissingAtBuild,
    shortenRevalidateIfFmpFailedAtBuild,
} from '@/shared/cache/buildDegradedRevalidate';
import {
    __resetFmpBuildBreakerForTests,
    tripFmpBuildBreaker,
} from '@/shared/api/offlineBuild';

// 래퍼는 모듈 로드 시점에 한 번 만들어진다 — 어떤 `clearAllMocks`보다 먼저 호출 기록을 캡처한다.
const WRAPPER_OPTIONS = vi
    .mocked(unstable_cache)
    .mock.calls.map(call => call[2]);

describe('shortenRevalidateIfFmpFailedAtBuild', () => {
    // 래퍼는 빌드(60초)·런타임(300초) 두 개라 revalidate로 찾는다 — 순서에 기대지 않는다.
    const wrapperOptions = WRAPPER_OPTIONS.find(o => o?.revalidate === 60);

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

describe('shortenRevalidateForRuntimeDegrade', () => {
    beforeEach(() => {
        pinMock.mockClear();
    });

    it('런타임 degrade 핀은 300초다 — 빌드 핀(60초)과 별개 값이다', () => {
        expect(RUNTIME_DEGRADED_REVALIDATE_SECONDS).toBe(300);
        expect(BUILD_DEGRADED_REVALIDATE_SECONDS).toBe(60);
        expect(WRAPPER_OPTIONS.some(o => o?.revalidate === 300)).toBe(true);
    });

    it('FMP·DB 상태와 무관하게 래퍼를 호출한다', async () => {
        await shortenRevalidateForRuntimeDegrade();
        expect(pinMock).toHaveBeenCalledOnce();
    });

    // 호출부는 degrade를 처리하는 catch 블록이다 — 핀이 던지면 원래 에러를 덮어써 500이 된다.
    it('렌더 컨텍스트 밖이라 래퍼가 던져도 삼키고 warn만 남긴다(호출부를 던지게 하지 않는다)', async () => {
        const warnSpy = vi
            .spyOn(console, 'warn')
            .mockImplementation(() => undefined);
        pinMock.mockRejectedValueOnce(
            new Error('Invariant: incrementalCache missing in unstable_cache')
        );

        await expect(
            shortenRevalidateForRuntimeDegrade()
        ).resolves.toBeUndefined();
        expect(warnSpy).toHaveBeenCalledOnce();
        warnSpy.mockRestore();
    });
});

describe('shortenRevalidateForIncompleteSession', () => {
    beforeEach(() => {
        pinMock.mockClear();
    });

    // `lagging`은 장애가 아니라 흔한 상태라(저유동 종목은 한 세션 내내) 5분이면 재생성이 폭증한다.
    // 그래도 세션 키 캐시의 24h보다는 훨씬 짧아야 직전 세션 HTML이 굳지 않는다.
    it('1h 래퍼다 — 런타임 degrade(300초)보다 길고 세션 키 캐시(24h)보다 짧다', () => {
        expect(INCOMPLETE_SESSION_REVALIDATE_SECONDS).toBe(3600);
        expect(WRAPPER_OPTIONS.some(o => o?.revalidate === 3600)).toBe(true);
    });

    it('래퍼를 호출한다', async () => {
        await shortenRevalidateForIncompleteSession();
        expect(pinMock).toHaveBeenCalledOnce();
    });

    it('렌더 컨텍스트 밖이라 래퍼가 던져도 삼킨다', async () => {
        const warnSpy = vi
            .spyOn(console, 'warn')
            .mockImplementation(() => undefined);
        pinMock.mockRejectedValueOnce(new Error('incrementalCache missing'));

        await expect(
            shortenRevalidateForIncompleteSession()
        ).resolves.toBeUndefined();
        expect(warnSpy).toHaveBeenCalledOnce();
        warnSpy.mockRestore();
    });
});
