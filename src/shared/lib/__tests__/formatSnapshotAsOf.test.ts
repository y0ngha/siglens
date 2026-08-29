import { describe, it, expect, vi } from 'vitest';
import { formatSnapshotAsOf } from '../formatSnapshotAsOf';

describe('formatSnapshotAsOf(us-equity)', () => {
    it('미국 동부 기준 날짜를 한국어로 포맷한다', () => {
        // 2026-07-31T20:00:00Z = 2026-07-31 16:00 America/New_York (EDT, 장마감)
        expect(
            formatSnapshotAsOf(
                new Date('2026-07-31T20:00:00Z'),
                'us-equity',
                'ko'
            )
        ).toBe('2026년 7월 31일');
    });

    it('UTC 자정을 넘었어도 동부 기준 날짜를 쓴다', () => {
        // 2026-08-01T01:00:00Z = 2026-07-31 21:00 America/New_York
        expect(
            formatSnapshotAsOf(
                new Date('2026-08-01T01:00:00Z'),
                'us-equity',
                'ko'
            )
        ).toBe('2026년 7월 31일');
    });

    it('월 경계를 올바르게 넘긴다', () => {
        // 2026-08-01T13:00:00Z = 2026-08-01 09:00 America/New_York
        expect(
            formatSnapshotAsOf(
                new Date('2026-08-01T13:00:00Z'),
                'us-equity',
                'ko'
            )
        ).toBe('2026년 8월 1일');
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
            results.push(freshFormat(date, 'us-equity', 'ko'));
        }
        vi.unstubAllEnvs();
        vi.resetModules();

        expect(new Set(results).size).toBe(1);
        expect(results[0]).toBe('2026년 7월 31일');
    });
});

/**
 * SEO 감사(2026-08-18): 이전에는 세 시장 전부 America/New_York 하나로 포맷했다 —
 * 한국 주식·크립토 페이지가 미국 장마감을 자처했다. 아래 두 describe는 `marketProfile`
 * 별로 실제 타임존이 갈리는지, 그리고 (미국과 달리) 같은 순간이 다른 날짜로 나오는
 * 경계 사례를 직접 겨냥한다.
 */
describe('formatSnapshotAsOf(kr-equity)', () => {
    it('Asia/Seoul(DST 없음) 기준으로 포맷하고, 같은 순간이 us-equity와 다른 날짜로 나온다', () => {
        // 2026-07-31T20:00:00Z = 2026-08-01 05:00 KST(다음날) vs America/New_York
        // 기준으로는 여전히 07-31 16:00(EDT) — 같은 순간이 시장에 따라 날짜가 갈린다.
        const instant = new Date('2026-07-31T20:00:00Z');
        expect(formatSnapshotAsOf(instant, 'kr-equity', 'ko')).toBe(
            '2026년 8월 1일'
        );
        expect(formatSnapshotAsOf(instant, 'us-equity', 'ko')).toBe(
            '2026년 7월 31일'
        );
    });

    it('KST는 DST가 없어 겨울에도 같은 +9시간 오프셋이다', () => {
        // 2026-01-12T21:30:00Z + 9h = 2026-01-13 06:30 KST
        expect(
            formatSnapshotAsOf(
                new Date('2026-01-12T21:30:00Z'),
                'kr-equity',
                'ko'
            )
        ).toBe('2026년 1월 13일');
    });
});

describe('formatSnapshotAsOf(crypto)', () => {
    it('UTC 기준으로 포맷하고, 같은 순간이 us-equity와 다른 날짜로 나온다', () => {
        // 2026-08-01T02:00:00Z는 UTC로 이미 8/1이지만, America/New_York(EDT,
        // UTC-4)로는 아직 07-31 22:00 — crypto는 특정 거래소 마감이 없는 24/7
        // 시장이라 America/New_York을 더 이상 따르지 않는다.
        const instant = new Date('2026-08-01T02:00:00Z');
        expect(formatSnapshotAsOf(instant, 'crypto', 'ko')).toBe(
            '2026년 8월 1일'
        );
        expect(formatSnapshotAsOf(instant, 'us-equity', 'ko')).toBe(
            '2026년 7월 31일'
        );
    });
});

describe('formatSnapshotAsOf — Invalid Date', () => {
    // A1(감사): 세 명의 감사자가 독립적으로 지적 — Intl.DateTimeFormat.format()은
    // Invalid Date에 RangeError를 던진다. 이 함수는 ISR 렌더 안에서 호출되므로
    // 그 throw는 getSeoSnapshotsStatic의 try/catch 바깥이라 잡히지 않는다.
    // null을 반환해 호출부가 고정 캡션으로 degrade하게 한다 — 렌더를 멈추지 않는다.
    it('Invalid Date를 넣으면 throw하지 않고 null을 반환한다', () => {
        expect(
            formatSnapshotAsOf(new Date('nope'), 'us-equity', 'ko')
        ).toBeNull();
    });
});

/**
 * 로케일 회귀.
 *
 * 예전에는 포맷터가 시장별 상수 3개였고 로케일이 `'ko-KR'`로 **고정**돼 있었다 —
 * `/en/AAPL`의 기준일 캡션이 `2026년 8월 18일`로 나갔다. 종목 9개 탭 전부,
 * 비-ko 3개 로케일 전부가 영향을 받았다.
 */
describe('formatSnapshotAsOf — 로케일', () => {
    const INSTANT = new Date('2026-07-31T20:00:00Z');

    it('ko는 한국어 날짜다', () => {
        expect(formatSnapshotAsOf(INSTANT, 'us-equity', 'ko')).toBe(
            '2026년 7월 31일'
        );
    });

    it.each(['en', 'ja', 'zh'] as const)('%s는 한글을 쓰지 않는다', locale => {
        const formatted = formatSnapshotAsOf(INSTANT, 'us-equity', locale);

        expect(formatted).not.toBeNull();
        expect(formatted!).not.toMatch(/[가-힣]/);
    });

    it('en은 영어 월 이름을 쓴다', () => {
        expect(formatSnapshotAsOf(INSTANT, 'us-equity', 'en')).toBe(
            'July 31, 2026'
        );
    });
});
