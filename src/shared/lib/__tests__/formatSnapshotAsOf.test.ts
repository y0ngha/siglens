import { describe, it, expect, vi } from 'vitest';
import { formatSnapshotAsOf } from '../formatSnapshotAsOf';

describe('formatSnapshotAsOf', () => {
    it('미국 동부 기준 날짜를 한국어로 포맷한다', () => {
        // 2026-07-31T20:00:00Z = 2026-07-31 16:00 America/New_York (EDT, 장마감)
        expect(formatSnapshotAsOf(new Date('2026-07-31T20:00:00Z'))).toBe(
            '2026년 7월 31일'
        );
    });

    it('UTC 자정을 넘었어도 동부 기준 날짜를 쓴다', () => {
        // 2026-08-01T01:00:00Z = 2026-07-31 21:00 America/New_York
        expect(formatSnapshotAsOf(new Date('2026-08-01T01:00:00Z'))).toBe(
            '2026년 7월 31일'
        );
    });

    it('월 경계를 올바르게 넘긴다', () => {
        // 2026-08-01T13:00:00Z = 2026-08-01 09:00 America/New_York
        expect(formatSnapshotAsOf(new Date('2026-08-01T13:00:00Z'))).toBe(
            '2026년 8월 1일'
        );
    });

    // B3(감사): 이전에는 `expect(f(date)).toBe(f(date))`로, 순수함수라면 항상
    // 참인 동어반복이었다(구현이 무엇을 반환하든 자기 자신과 항상 같다) — 실제로
    // 중요한 속성은 "같은 프로세스 안에서 두 번 호출해도 같다"가 아니라 "서버의
    // 기본 TZ가 무엇이든 같다"이다. formatSnapshotAsOf가 America/New_York을
    // 명시 고정하지 않았다면 이 값은 배포 환경(TZ 환경변수)에 따라 달라져
    // ISR 캐시 엔트리 간 출력이 흔들렸을 것이다.
    //
    // `SNAPSHOT_AS_OF_FORMATTER`는 모듈 최상단에서 한 번만 생성되는 싱글턴이라,
    // 이미 로드된 모듈에 대고 `vi.stubEnv('TZ', …)`만 호출하면 Intl 객체가 이미
    // 생성 시점의 TZ로 굳어 있어 아무 의미도 없다(그 자체로 또 다른 동어반복이
    // 된다). TZ별로 실제 차이를 검증하려면 스텁 후 모듈을 새로 import해
    // 포맷터를 그 TZ 아래에서 다시 생성시켜야 한다 — `timeZone:
    // 'America/New_York'`을 명시 고정하지 않았다면, 이 재생성된 포맷터들의
    // 결과가 TZ마다 달라졌을 것이다.
    it('서버 프로세스의 TZ 환경변수와 무관하게 항상 같은 문자열을 낸다 (ISR 캐시 결정성)', async () => {
        const date = new Date('2026-07-31T20:00:00Z');
        const results: (string | null)[] = [];
        for (const tz of ['Asia/Seoul', 'UTC', 'America/Los_Angeles']) {
            vi.stubEnv('TZ', tz);
            vi.resetModules();
            const { formatSnapshotAsOf: freshFormat } =
                await import('../formatSnapshotAsOf');
            results.push(freshFormat(date));
        }
        vi.unstubAllEnvs();
        vi.resetModules();

        expect(new Set(results).size).toBe(1);
        expect(results[0]).toBe('2026년 7월 31일');
    });
});

describe('formatSnapshotAsOf — Invalid Date', () => {
    // A1(감사): 세 명의 감사자가 독립적으로 지적 — Intl.DateTimeFormat.format()은
    // Invalid Date에 RangeError를 던진다. 이 함수는 ISR 렌더 안에서 호출되므로
    // 그 throw는 getSeoSnapshotsStatic의 try/catch 바깥이라 잡히지 않는다.
    // null을 반환해 호출부가 고정 캡션으로 degrade하게 한다 — 렌더를 멈추지 않는다.
    it('Invalid Date를 넣으면 throw하지 않고 null을 반환한다', () => {
        expect(formatSnapshotAsOf(new Date('nope'))).toBeNull();
    });
});
