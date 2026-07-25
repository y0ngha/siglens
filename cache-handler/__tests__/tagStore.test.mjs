import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const {
    isUpstashConfigured,
    zaddGreater,
    zrangeFromScore,
    zremBelowScore,
    serverTimeMs,
    expireKey,
} = vi.hoisted(() => ({
    isUpstashConfigured: vi.fn(() => true),
    zaddGreater: vi.fn(async () => {}),
    zrangeFromScore: vi.fn(async () => ({ pairs: [], rawLength: 0 })),
    zremBelowScore: vi.fn(async () => {}),
    serverTimeMs: vi.fn(async () => Date.now()),
    expireKey: vi.fn(async () => {}),
}));

vi.mock('../upstashRest.mjs', () => ({
    isUpstashConfigured,
    zaddGreater,
    zrangeFromScore,
    zremBelowScore,
    serverTimeMs,
    expireKey,
}));

import {
    markRevalidated,
    maxRevalidatedAt,
    ensureTagsFresh,
    publishRevalidated,
    _resetForTest,
} from '../tagStore.mjs';

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const RETENTION_MS = 7 * DAY_MS;
const KEY_TTL_SECONDS = 30 * 24 * 60 * 60;
const REFRESH_INTERVAL_MS = 5_000;
const BOOTSTRAP_AWAIT_MS = 1_000;
const NOW = 1_700_000_000_000;

// ensureTagsFresh()의 백그라운드(부트스트랩 이후) sync는 await되지 않는다 — 호출 시점에
// zrangeFromScore가 동기적으로 불려도(호출 카운트는 즉시 증가) 그 뒤의 .then/.catch/.finally
// 체인(consecutiveFailures 갱신, syncInFlight=null, 로그)은 마이크로태스크 몇 틱 후에야 끝난다.
// vi.waitFor는 조건이 이미 참이면 그 즉시 resolve해버려 이 체인의 완료를 보장하지 않으므로,
// 체인 완료에 의존하는 다음 단언 전에는 명시적으로 마이크로태스크를 흘려보내야 한다.
async function flushAsync() {
    for (let i = 0; i < 5; i++) await Promise.resolve();
}

beforeEach(() => {
    _resetForTest();
    isUpstashConfigured.mockReturnValue(true);
    zaddGreater.mockReset().mockResolvedValue(undefined);
    zrangeFromScore.mockReset().mockResolvedValue({ pairs: [], rawLength: 0 });
    zremBelowScore.mockReset().mockResolvedValue(undefined);
    serverTimeMs.mockReset().mockResolvedValue(NOW);
    expireKey.mockReset().mockResolvedValue(undefined);
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe('tagStore — 로컬 맵 (hot path)', () => {
    it('미등록 태그는 0을 반환한다(fresh)', () => {
        expect(maxRevalidatedAt(['symbol:AAPL'])).toBe(0);
    });

    it('revalidate된 태그의 타임스탬프를 반환한다(read-your-writes)', () => {
        markRevalidated('news:AAPL', 1000);
        expect(maxRevalidatedAt(['news:AAPL'])).toBe(1000);
    });

    it('여러 태그 중 최댓값을 반환한다', () => {
        markRevalidated('a', 1000);
        markRevalidated('b', 2000);
        expect(maxRevalidatedAt(['a', 'b', 'c'])).toBe(2000);
    });

    it('더 오래된 타임스탬프로는 되돌아가지 않는다(max 병합)', () => {
        markRevalidated('a', 2000);
        markRevalidated('a', 1000);
        expect(maxRevalidatedAt(['a'])).toBe(2000);
    });

    it('maxRevalidatedAt은 동기 — Promise를 반환하지 않는다', () => {
        expect(maxRevalidatedAt(['a'])).not.toBeInstanceOf(Promise);
    });
});

describe('tagStore — ensureTagsFresh (원격 → 로컬 병합)', () => {
    it('Upstash 미설정이면 no-op이고 원격을 호출하지 않는다', () => {
        isUpstashConfigured.mockReturnValue(false);
        expect(ensureTagsFresh()).toBeUndefined();
        expect(zrangeFromScore).not.toHaveBeenCalled();
    });

    it('부트스트랩(최초 1회)만 Promise를 반환해 호출부가 await하게 한다', async () => {
        const first = ensureTagsFresh();
        expect(first).toBeInstanceOf(Promise);
        await first;
        expect(ensureTagsFresh()).toBeUndefined();
    });

    it('원격 태그를 로컬 맵에 병합한다', async () => {
        zrangeFromScore.mockResolvedValueOnce({
            pairs: [['news:AAPL', NOW - 5_000]],
            rawLength: 2,
        });
        await ensureTagsFresh();
        expect(maxRevalidatedAt(['news:AAPL'])).toBe(NOW - 5_000);
    });

    it('부트스트랩은 보존 기간 전체를 읽어 콜드 인스턴스가 기존 무효화를 학습한다', async () => {
        await ensureTagsFresh();
        expect(zrangeFromScore).toHaveBeenCalledWith(
            'siglens:isr:tags',
            NOW - RETENTION_MS
        );
    });

    it('두 번째 sync는 증분 — 지난 sync 시각에서 오버랩만 뺀 지점부터 읽는다', async () => {
        await ensureTagsFresh();
        vi.setSystemTime(NOW + 10_000);
        await ensureTagsFresh();
        expect(zrangeFromScore).toHaveBeenLastCalledWith(
            'siglens:isr:tags',
            NOW - 60_000
        );
    });

    it('refresh 간격 이내 재호출은 원격을 다시 치지 않는다', async () => {
        await ensureTagsFresh();
        vi.setSystemTime(NOW + 1_000);
        ensureTagsFresh();
        expect(zrangeFromScore).toHaveBeenCalledTimes(1);
    });

    it('refresh 간격이 지나면 백그라운드로 다시 동기화한다', async () => {
        await ensureTagsFresh();
        vi.setSystemTime(NOW + 5_001);
        expect(ensureTagsFresh()).toBeUndefined(); // read 경로에 지연 없음
        await vi.waitFor(() =>
            expect(zrangeFromScore).toHaveBeenCalledTimes(2)
        );
    });

    it('동시 호출은 하나의 in-flight sync로 합쳐진다', async () => {
        const a = ensureTagsFresh();
        const b = ensureTagsFresh();
        await Promise.all([a, b]);
        expect(zrangeFromScore).toHaveBeenCalledTimes(1);
    });

    it('원격이 더 오래된 값을 주면 로컬 최신값을 되돌리지 않는다', async () => {
        markRevalidated('a', NOW - 1_000);
        zrangeFromScore.mockResolvedValueOnce({
            pairs: [['a', NOW - 9_000]],
            rawLength: 2,
        });
        await ensureTagsFresh();
        expect(maxRevalidatedAt(['a'])).toBe(NOW - 1_000);
    });

    it('원격 오류는 throw하지 않고 로컬 전용으로 degrade한다(fail-open)', async () => {
        zrangeFromScore.mockRejectedValueOnce(new Error('boom'));
        markRevalidated('a', NOW - 1_000);
        await expect(ensureTagsFresh()).resolves.toBeUndefined();
        expect(maxRevalidatedAt(['a'])).toBe(NOW - 1_000);
    });

    it('부트스트랩이 실패해도 이후 요청을 await로 막지 않는다', async () => {
        zrangeFromScore.mockRejectedValueOnce(new Error('boom'));
        await ensureTagsFresh();
        expect(ensureTagsFresh()).toBeUndefined();
    });

    it('보존 기간이 지난 로컬 엔트리는 정리해 맵이 무한정 커지지 않게 한다', async () => {
        markRevalidated('stale', NOW - 8 * DAY_MS);
        markRevalidated('recent', NOW - 1000);
        await ensureTagsFresh();
        expect(maxRevalidatedAt(['stale'])).toBe(0);
        expect(maxRevalidatedAt(['recent'])).toBe(NOW - 1000);
    });

    it('정리 경계 — 보존 기간 하한과 정확히 같은 엔트리는 유지되고, 1ms 더 오래된 건 삭제된다', async () => {
        const floor = NOW - RETENTION_MS;
        markRevalidated('exact', floor);
        markRevalidated('older', floor - 1);
        await ensureTagsFresh();
        expect(maxRevalidatedAt(['exact'])).toBe(floor);
        expect(maxRevalidatedAt(['older'])).toBe(0);
    });

    it('부트스트랩 후 8일이 지나 다시 sync하면 floor는 그 시점-7일이지 syncedThrough-60초가 아니다', async () => {
        await ensureTagsFresh(); // 부트스트랩 성공, syncedThrough = NOW

        const later = NOW + 8 * DAY_MS;
        vi.setSystemTime(later);
        expect(ensureTagsFresh()).toBeUndefined(); // refresh 간격을 훌쩍 지나 새 sync 트리거
        await vi.waitFor(() =>
            expect(zrangeFromScore).toHaveBeenCalledTimes(2)
        );

        expect(zrangeFromScore).toHaveBeenLastCalledWith(
            'siglens:isr:tags',
            later - RETENTION_MS
        );
    });

    // 이 파일에서 가장 중요한 회귀 테스트다.
    // syncedThrough는 zrangeFromScore를 **await한 뒤에만** 전진해야 한다. 이 대입이
    // await 위로 올라가거나 finally로 옮겨지면, 실패한 부트스트랩이 워터마크를 전진시켜
    // 다음 sync가 60초 창만 읽는다 → 그 인스턴스는 7일치 백필을 영구히 건너뛰고,
    // 다른 인스턴스가 이미 무효화한 **공유** S3 엔트리를 계속 fresh로 서빙한다.
    it('부트스트랩이 실패하면 워터마크를 전진시키지 않아 다음 sync가 보존 기간 전체를 다시 읽는다', async () => {
        zrangeFromScore.mockRejectedValueOnce(new Error('boom'));
        await ensureTagsFresh(); // 부트스트랩 실패 → syncedThrough는 0으로 남아야 한다

        const retryAt = NOW + 1_000; // 백오프 첫 재시도 시점
        vi.setSystemTime(retryAt);
        expect(ensureTagsFresh()).toBeUndefined();
        await vi.waitFor(() =>
            expect(zrangeFromScore).toHaveBeenCalledTimes(2)
        );

        // 성공했다면 floor는 retryAt - 60초였을 것이다. 실패했으므로 7일 전체여야 한다.
        expect(zrangeFromScore).toHaveBeenLastCalledWith(
            'siglens:isr:tags',
            retryAt - RETENTION_MS
        );
        expect(zrangeFromScore).not.toHaveBeenLastCalledWith(
            'siglens:isr:tags',
            retryAt - 60_000
        );
    });

    it('sync가 성공한 뒤에야 워터마크가 전진해 증분 창으로 좁아진다', async () => {
        zrangeFromScore.mockRejectedValueOnce(new Error('boom'));
        await ensureTagsFresh(); // 실패

        const recoverAt = NOW + 1_000;
        vi.setSystemTime(recoverAt);
        ensureTagsFresh(); // 성공(기본 mock)
        await vi.waitFor(() =>
            expect(zrangeFromScore).toHaveBeenCalledTimes(2)
        );
        await flushAsync();

        const afterRecovery = recoverAt + 5_000;
        vi.setSystemTime(afterRecovery);
        ensureTagsFresh();
        await vi.waitFor(() =>
            expect(zrangeFromScore).toHaveBeenCalledTimes(3)
        );

        // 복구된 sync가 워터마크를 recoverAt으로 올렸으므로 이제 증분 창을 쓴다.
        expect(zrangeFromScore).toHaveBeenLastCalledWith(
            'siglens:isr:tags',
            recoverAt - 60_000
        );
    });
});

describe('tagStore — 실패 백오프', () => {
    it('실패 후 다음 재시도는 5초가 아니라 1초 뒤에 허용된다', async () => {
        zrangeFromScore.mockRejectedValueOnce(new Error('boom'));
        await ensureTagsFresh(); // 부트스트랩 실패 → consecutiveFailures=1

        vi.setSystemTime(NOW + 999);
        expect(ensureTagsFresh()).toBeUndefined();
        expect(zrangeFromScore).toHaveBeenCalledTimes(1); // 아직 1초가 안 지남 — 재시도 안 됨

        zrangeFromScore.mockResolvedValueOnce({ pairs: [], rawLength: 0 });
        vi.setSystemTime(NOW + 1_000);
        expect(ensureTagsFresh()).toBeUndefined();
        await vi.waitFor(() =>
            expect(zrangeFromScore).toHaveBeenCalledTimes(2)
        );
    });

    it('실패가 누적되면 재시도 간격이 2초 → 4초로 늘어난다', async () => {
        zrangeFromScore.mockRejectedValue(new Error('boom'));
        await ensureTagsFresh(); // cf=1, gap=1s

        vi.setSystemTime(NOW + 1_000);
        expect(ensureTagsFresh()).toBeUndefined();
        await vi.waitFor(() =>
            expect(zrangeFromScore).toHaveBeenCalledTimes(2)
        ); // 실패 → cf=2, 다음 gap=2s
        await flushAsync(); // cf 갱신 + syncInFlight=null 반영 대기

        vi.setSystemTime(NOW + 1_000 + 1_999);
        expect(ensureTagsFresh()).toBeUndefined();
        expect(zrangeFromScore).toHaveBeenCalledTimes(2); // 아직 2초가 안 지남

        vi.setSystemTime(NOW + 1_000 + 2_000);
        expect(ensureTagsFresh()).toBeUndefined();
        await vi.waitFor(() =>
            expect(zrangeFromScore).toHaveBeenCalledTimes(3)
        ); // 실패 → cf=3, 다음 gap=4s
        await flushAsync();

        vi.setSystemTime(NOW + 1_000 + 2_000 + 3_999);
        expect(ensureTagsFresh()).toBeUndefined();
        expect(zrangeFromScore).toHaveBeenCalledTimes(3); // 아직 4초가 안 지남

        vi.setSystemTime(NOW + 1_000 + 2_000 + 4_000);
        expect(ensureTagsFresh()).toBeUndefined();
        await vi.waitFor(() =>
            expect(zrangeFromScore).toHaveBeenCalledTimes(4)
        );
    });

    it('실패가 지속되면 재시도 간격이 60초에서 상한된다', async () => {
        zrangeFromScore.mockRejectedValue(new Error('boom'));
        await ensureTagsFresh(); // cf=1

        // 매번 60초(= 상한값)씩 전진시키면 어떤 cf 값의 gap(최대 60초)도 항상 충족된다.
        let cursor = NOW;
        for (let i = 0; i < 7; i++) {
            cursor += 60_000;
            vi.setSystemTime(cursor);
            expect(ensureTagsFresh()).toBeUndefined();
            const expectedCalls = i + 2;
            await vi.waitFor(() =>
                expect(zrangeFromScore).toHaveBeenCalledTimes(expectedCalls)
            );
            await flushAsync(); // 다음 반복의 gap 계산이 갱신된 cf를 보도록 체인 완료 대기
        }
        // 이 시점 cf=8(부트스트랩 1회 + 루프 7회 실패) — 2^7*1s=128s인데 실제 gap은
        // 여전히 60초 상한이어야 한다.
        vi.setSystemTime(cursor + 59_999);
        expect(ensureTagsFresh()).toBeUndefined();
        expect(zrangeFromScore).toHaveBeenCalledTimes(8);

        vi.setSystemTime(cursor + 60_000);
        expect(ensureTagsFresh()).toBeUndefined();
        await vi.waitFor(() =>
            expect(zrangeFromScore).toHaveBeenCalledTimes(9)
        );
    });

    it('성공하면 재시도 카운터가 리셋되고 정상 주기(5초)로 돌아온다', async () => {
        zrangeFromScore.mockRejectedValueOnce(new Error('boom'));
        await ensureTagsFresh(); // cf=1, gap=1s

        zrangeFromScore.mockResolvedValueOnce({ pairs: [], rawLength: 0 });
        vi.setSystemTime(NOW + 1_000);
        expect(ensureTagsFresh()).toBeUndefined();
        await vi.waitFor(() =>
            expect(zrangeFromScore).toHaveBeenCalledTimes(2)
        ); // 성공 → cf=0
        await flushAsync(); // cf 리셋 반영 대기

        vi.setSystemTime(NOW + 1_000 + 4_999);
        expect(ensureTagsFresh()).toBeUndefined();
        expect(zrangeFromScore).toHaveBeenCalledTimes(2); // 5초 미만이면 재시도 안 함

        vi.setSystemTime(NOW + 1_000 + 5_000);
        expect(ensureTagsFresh()).toBeUndefined();
        await vi.waitFor(() =>
            expect(zrangeFromScore).toHaveBeenCalledTimes(3)
        );
    });
});

describe('tagStore — 부트스트랩 대기 상한 및 안정 상태 동작', () => {
    it('부트스트랩 sync가 영원히 settle되지 않아도 BOOTSTRAP_AWAIT_MS 이후 read 경로는 통과한다', async () => {
        zrangeFromScore.mockReturnValueOnce(new Promise(() => {}));
        const bootstrapPromise = ensureTagsFresh();
        expect(bootstrapPromise).toBeInstanceOf(Promise);

        await vi.advanceTimersByTimeAsync(BOOTSTRAP_AWAIT_MS);
        await expect(bootstrapPromise).resolves.toBeUndefined();
    });

    it('안정 상태에서 in-flight sync 중 재호출은 즉시 undefined이고 zrangeFromScore는 추가로 늘지 않는다', async () => {
        await ensureTagsFresh(); // 부트스트랩 성공 → bootstrapped=true, 호출 1회
        vi.setSystemTime(NOW + REFRESH_INTERVAL_MS);

        zrangeFromScore.mockReturnValueOnce(new Promise(() => {})); // 영원히 settle 안 됨
        const first = ensureTagsFresh(); // 새 sync를 시작시킴 → 호출 2회
        expect(first).toBeUndefined();

        const second = ensureTagsFresh(); // 이미 in-flight
        expect(second).toBeUndefined();
        const third = ensureTagsFresh();
        expect(third).toBeUndefined();

        expect(zrangeFromScore).toHaveBeenCalledTimes(2);
    });
});

describe('tagStore — 스코프별 에러 로그 스로틀', () => {
    it('sync 실패와 publish 실패가 겹치면 스코프별로 각각 로그돼 총 2번 기록된다', async () => {
        zrangeFromScore.mockRejectedValueOnce(new Error('sync boom'));
        await ensureTagsFresh(); // sync 실패 로그 1회

        zaddGreater.mockRejectedValue(new Error('publish boom'));
        await publishRevalidated(['a'], NOW); // 재시도도 실패 → publish 실패 로그 1회

        expect(console.error).toHaveBeenCalledTimes(2);
        expect(console.error.mock.calls[0][0]).toMatch(
            /^\[isr-cache\] tag sync failed/
        );
        expect(console.error.mock.calls[1][0]).toMatch(
            /^\[isr-cache\] tag publish failed/
        );
    });

    it('같은 스코프에서 60초 이내 실패가 반복되면 한 번만 로그된다', async () => {
        zrangeFromScore.mockRejectedValue(new Error('boom'));
        await ensureTagsFresh(); // 1회차 실패 로그

        vi.setSystemTime(NOW + 1_000); // 재시도 gap만 지남(60초 로그 스로틀 창은 아직)
        expect(ensureTagsFresh()).toBeUndefined();
        await vi.waitFor(() =>
            expect(zrangeFromScore).toHaveBeenCalledTimes(2)
        );
        await flushAsync(); // 2번째 실패의 catch(logThrottled)가 스로틀로 억제되는 것까지 확인

        expect(console.error).toHaveBeenCalledTimes(1);
    });

    it('60초가 지나면 같은 스코프도 다시 로그한다', async () => {
        zrangeFromScore.mockRejectedValue(new Error('boom'));
        await ensureTagsFresh(); // 1회차 실패 로그

        vi.setSystemTime(NOW + 60_000 + 1);
        expect(ensureTagsFresh()).toBeUndefined();
        await vi.waitFor(() =>
            expect(zrangeFromScore).toHaveBeenCalledTimes(2)
        );
        await flushAsync(); // 2번째 실패의 catch(logThrottled) 완료 대기

        expect(console.error).toHaveBeenCalledTimes(2);
    });
});

describe('tagStore — 네트워크 없는 읽기 경로 불변식', () => {
    it('부트스트랩 완료 후 maxRevalidatedAt을 100번 호출해도 upstash mock은 전혀 호출되지 않는다', async () => {
        await ensureTagsFresh(); // 부트스트랩
        markRevalidated('a', NOW - 1_000);
        markRevalidated('b', NOW - 500);

        zrangeFromScore.mockClear();
        zaddGreater.mockClear();
        zremBelowScore.mockClear();
        serverTimeMs.mockClear();
        expireKey.mockClear();

        let result;
        for (let i = 0; i < 100; i++) {
            result = maxRevalidatedAt(['a', 'b']);
        }

        expect(result).toBe(NOW - 500);
        expect(zrangeFromScore).not.toHaveBeenCalled();
        expect(zaddGreater).not.toHaveBeenCalled();
        expect(zremBelowScore).not.toHaveBeenCalled();
        expect(serverTimeMs).not.toHaveBeenCalled();
        expect(expireKey).not.toHaveBeenCalled();
    });
});

describe('tagStore — 와이어 포맷/시계 어긋남 신호', () => {
    it('rawLength>0인데 파싱된 쌍이 0이면 와이어 포맷 변경 경고를 로그한다', async () => {
        zrangeFromScore.mockResolvedValueOnce({ pairs: [], rawLength: 3 });
        await ensureTagsFresh();

        expect(console.error).toHaveBeenCalledTimes(1);
        expect(console.error.mock.calls[0][0]).toMatch(
            /^\[isr-cache\] tag sync failed/
        );
        expect(console.error.mock.calls[0][2]).toMatch(/wire format/);
    });

    it('병합하는 score가 10초 이상 미래면 시계 어긋남 경고를 로그하지만 값은 병합한다', async () => {
        const futureScore = NOW + 11_000;
        zrangeFromScore.mockResolvedValueOnce({
            pairs: [['skewed', futureScore]],
            rawLength: 2,
        });
        await ensureTagsFresh();

        expect(maxRevalidatedAt(['skewed'])).toBe(futureScore);
        expect(console.error).toHaveBeenCalledTimes(1);
        expect(console.error.mock.calls[0][2]).toMatch(/clock skew/);
    });
});

describe('tagStore — publishRevalidated (durable 기록)', () => {
    it('Upstash 미설정이면 원격을 호출하지 않는다', async () => {
        isUpstashConfigured.mockReturnValue(false);
        await publishRevalidated(['a'], NOW);
        expect(zaddGreater).not.toHaveBeenCalled();
    });

    it('태그를 (score, member) 쌍으로 기록한다', async () => {
        await publishRevalidated(['a', 'b'], NOW);
        expect(zaddGreater).toHaveBeenCalledWith('siglens:isr:tags', [
            [NOW, 'a'],
            [NOW, 'b'],
        ]);
    });

    it('빈 문자열·비문자열 태그는 걸러낸다', async () => {
        await publishRevalidated(['', null, 42, 'ok'], NOW);
        expect(zaddGreater).toHaveBeenCalledWith('siglens:isr:tags', [
            [NOW, 'ok'],
        ]);
    });

    it('유효 태그가 없으면 원격을 호출하지 않는다', async () => {
        await publishRevalidated(['', null], NOW);
        expect(zaddGreater).not.toHaveBeenCalled();
    });

    it('tags가 배열이 아니어도(단일 문자열) throw하지 않고 resolve된다', async () => {
        await expect(
            publishRevalidated('solo-tag', NOW)
        ).resolves.toBeUndefined();
        expect(zaddGreater).toHaveBeenCalledWith('siglens:isr:tags', [
            [NOW, 'solo-tag'],
        ]);
    });

    it('zaddGreater가 한 번 실패해도 재시도로 성공하면 로그하지 않고 2번 호출된다', async () => {
        zaddGreater
            .mockRejectedValueOnce(new Error('blip'))
            .mockResolvedValueOnce(undefined);
        await publishRevalidated(['a'], NOW);
        expect(zaddGreater).toHaveBeenCalledTimes(2);
        expect(console.error).not.toHaveBeenCalled();
    });

    it('zaddGreater가 두 번 다 실패하면 한 번만 로그하고 serverTimeMs는 호출되지 않는다', async () => {
        zaddGreater.mockRejectedValue(new Error('down'));
        await publishRevalidated(['a'], NOW);
        expect(zaddGreater).toHaveBeenCalledTimes(2);
        expect(console.error).toHaveBeenCalledTimes(1);
        expect(serverTimeMs).not.toHaveBeenCalled();
    });

    it('쓰기가 실패하면 정리(housekeeping)를 시도하지 않는다', async () => {
        zaddGreater.mockRejectedValue(new Error('boom'));
        await publishRevalidated(['a'], NOW);
        expect(zremBelowScore).not.toHaveBeenCalled();
    });

    it('보존 기간 지난 원격 엔트리를 정리한다(housekeeping, fire-and-forget)', async () => {
        await publishRevalidated(['a'], NOW);
        await vi.waitFor(() =>
            expect(zremBelowScore).toHaveBeenCalledWith(
                'siglens:isr:tags',
                NOW - RETENTION_MS
            )
        );
    });

    it('정리는 시간 게이트가 걸려 매 쓰기마다 돌지 않는다', async () => {
        await publishRevalidated(['a'], NOW);
        await vi.waitFor(() => expect(zremBelowScore).toHaveBeenCalledTimes(1));

        await publishRevalidated(['b'], NOW + 1000);
        expect(zremBelowScore).toHaveBeenCalledTimes(1);
    });

    it('게이트 시간이 지나면 다시 정리한다', async () => {
        await publishRevalidated(['a'], NOW);
        await vi.waitFor(() => expect(zremBelowScore).toHaveBeenCalledTimes(1));

        await publishRevalidated(['b'], NOW + HOUR_MS + 1);
        await vi.waitFor(() => expect(zremBelowScore).toHaveBeenCalledTimes(2));
    });

    it('정리(zremBelowScore) 실패도 throw하지 않는다', async () => {
        zremBelowScore.mockRejectedValueOnce(new Error('boom'));
        await expect(publishRevalidated(['a'], NOW)).resolves.toBeUndefined();
        await vi.waitFor(() => expect(zremBelowScore).toHaveBeenCalledTimes(1));
    });

    it('housekeeping은 await되지 않는다 — serverTimeMs가 settle되지 않아도 publishRevalidated는 resolve된다', async () => {
        serverTimeMs.mockReturnValueOnce(new Promise(() => {})); // 영원히 대기
        await expect(publishRevalidated(['a'], NOW)).resolves.toBeUndefined();
    });

    it('housekeeping은 서버 시각을 조회해 zremBelowScore에 로컬 now가 아닌 serverNow-7일을 넘긴다', async () => {
        const serverNow = NOW + 3_000; // 로컬 시계보다 3초 앞선 서버 시각을 시뮬레이션
        serverTimeMs.mockResolvedValueOnce(serverNow);

        await publishRevalidated(['a'], NOW);

        await vi.waitFor(() =>
            expect(zremBelowScore).toHaveBeenCalledWith(
                'siglens:isr:tags',
                serverNow - RETENTION_MS
            )
        );
        expect(expireKey).toHaveBeenCalledWith(
            'siglens:isr:tags',
            KEY_TTL_SECONDS
        );
    });
});
