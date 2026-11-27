import { describe, expect, it } from 'vitest';
import { dashboardCacheTtlSeconds } from '../dashboardCacheTtl';
import { KR_EQUITY_SESSION } from '../sessionSpecFor';
import {
    US_EQUITY_SESSION,
    computeBarsEffectiveTtl,
} from '@y0ngha/siglens-core';

describe('dashboardCacheTtlSeconds', () => {
    // KRX 장중(2026-08-18 월 11:00 KST = 02:00 UTC).
    const KRX_OPEN = new Date('2026-08-18T02:00:00Z');
    // NYSE 장중(2026-08-18 화 10:00 ET = 14:00 UTC).
    const NYSE_OPEN = new Date('2026-08-18T14:00:00Z');

    it('미국은 장중 TTL을 그대로 쓴다', () => {
        expect(dashboardCacheTtlSeconds('us', '1Day', NYSE_OPEN)).toBe(
            computeBarsEffectiveTtl('1Day', NYSE_OPEN, US_EQUITY_SESSION)
        );
    });

    /**
     * yahoo KR 시세가 약 20분 지연이라 60초 갱신은 같은 숫자를 스무 번 받는 일이다.
     * 그동안 `/market/kr` 리필 1회는 yahoo 49회를 쓴다(무인증, 프로세스 전역 큐).
     */
    it('한국은 장중에도 5분 하한을 적용한다', () => {
        const raw = computeBarsEffectiveTtl(
            '1Day',
            KRX_OPEN,
            KR_EQUITY_SESSION
        );
        expect(raw).toBeLessThan(300);
        expect(dashboardCacheTtlSeconds('kr', '1Day', KRX_OPEN)).toBe(300);
    });

    it('한국도 장외 TTL이 하한보다 크면 그대로 쓴다', () => {
        // 일요일 — 다음 개장까지 한참 남아 TTL이 길다.
        const sunday = new Date('2026-08-16T02:00:00Z');
        const raw = computeBarsEffectiveTtl('1Day', sunday, KR_EQUITY_SESSION);
        expect(raw).toBeGreaterThan(300);
        expect(dashboardCacheTtlSeconds('kr', '1Day', sunday)).toBe(raw);
    });
});
