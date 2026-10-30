import {
    buildRateLimitSnapshot,
    counterKey,
    listRateSlots,
    verdictFor,
    windowId,
} from '@/entities/siglens-api-key/lib/rateLimitWindow';
import { PUBLIC_API_RATE_LIMITS } from '@/shared/config/publicApi';

/** 2026-10-15T12:34:56Z — 분·일 창 경계에서 떨어진 시각. */
const NOW = new Date('2026-10-15T12:34:56.000Z');
const NOW_SEC = Math.floor(NOW.getTime() / 1000);

describe('windowId', () => {
    it('분 창은 60초 단위로 끝나고 키 TTL은 120초다', () => {
        const w = windowId('minute', NOW);
        expect(w.id).toBe(Math.floor(NOW_SEC / 60));
        expect(w.resetAtEpochSeconds).toBe((w.id + 1) * 60);
        expect(w.ttlSeconds).toBe(120);
    });

    it('일 창은 UTC 자정에 끝나고 키 TTL은 25시간이다', () => {
        const w = windowId('day', NOW);
        expect(w.id).toBe(Math.floor(NOW_SEC / 86400));
        expect(w.resetAtEpochSeconds).toBe(
            Date.parse('2026-10-16T00:00:00.000Z') / 1000
        );
        expect(w.ttlSeconds).toBe(90000);
    });
});

describe('counterKey', () => {
    it('저장된 카운터와 맞도록 키 형식을 유지한다', () => {
        expect(counterKey('u1', 'data', windowId('minute', NOW))).toBe(
            `siglens-api:rl:u1:data:m:${Math.floor(NOW_SEC / 60)}`
        );
        expect(counterKey('u1', 'ai', windowId('day', NOW))).toBe(
            `siglens-api:rl:u1:ai:d:${Math.floor(NOW_SEC / 86400)}`
        );
    });
});

describe('verdictFor', () => {
    const { perMinute } = PUBLIC_API_RATE_LIMITS.data;
    const w = windowId('minute', NOW);

    it('한도와 같은 횟수까지는 허용하고 남은 횟수는 0이 된다', () => {
        expect(verdictFor('data', w, perMinute, NOW)).toMatchObject({
            allowed: true,
            remaining: 0,
            limit: perMinute,
        });
    });

    it('한도를 넘기면 거절하고 남은 횟수는 음수가 되지 않는다', () => {
        expect(verdictFor('data', w, perMinute + 5, NOW)).toMatchObject({
            allowed: false,
            remaining: 0,
        });
    });

    it('창 마지막 초에도 retryAfter는 1 이상이다', () => {
        const last = new Date((w.resetAtEpochSeconds - 0.2) * 1000);
        expect(verdictFor('data', w, 1, last).retryAfterSeconds).toBe(1);
    });
});

describe('buildRateLimitSnapshot', () => {
    it('슬롯 순서대로 카운터를 맞춰 남은 한도를 계산한다', () => {
        const slots = listRateSlots(NOW);
        const counts = slots.map((_slot, index) => (index === 0 ? 7 : null));
        const snapshot = buildRateLimitSnapshot(slots, counts);
        expect(snapshot.data.minute.remaining).toBe(
            PUBLIC_API_RATE_LIMITS.data.perMinute - 7
        );
        expect(snapshot.data.day.remaining).toBe(
            PUBLIC_API_RATE_LIMITS.data.perDay
        );
    });

    it('문자열 카운터(Upstash 자동 파싱 전 값)도 숫자로 읽는다', () => {
        const slots = listRateSlots(NOW);
        const counts = slots.map(() => '3');
        expect(buildRateLimitSnapshot(slots, counts).ai.day.remaining).toBe(
            PUBLIC_API_RATE_LIMITS.ai.perDay - 3
        );
    });
});
