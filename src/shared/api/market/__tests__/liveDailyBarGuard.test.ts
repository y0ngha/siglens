import { type Bar, US_EQUITY_SESSION } from '@y0ngha/siglens-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    keepLiveDailyBar,
    liveDailyBarDropReason,
} from '@/shared/api/market/liveDailyBarGuard';
import { KR_EQUITY_SESSION } from '@/shared/api/market/sessionSpecFor';

const dailyBar = (isoDate: string): Bar => ({
    time: Math.floor(Date.parse(`${isoDate}T00:00:00Z`) / 1000),
    open: 10,
    high: 11,
    low: 9,
    close: 10.5,
    volume: 100,
});

const dropReason = (isoDate: string, now: string) =>
    liveDailyBarDropReason(dailyBar(isoDate), US_EQUITY_SESSION, new Date(now));

describe('liveDailyBarDropReason', () => {
    it('봉 날짜가 ET 오늘과 같으면(00:00:30 ET 자정 경계) 거래일이므로 유지한다', () => {
        // Tue 2026-12-01 00:00:30 EST = 05:00:30Z
        expect(dropReason('2026-12-01', '2026-12-01T05:00:30Z')).toBeNull();
        // 한 순간 앞(Mon 23:59:59 EST)이면 같은 봉은 미래 날짜다
        expect(dropReason('2026-12-01', '2026-12-01T04:59:59Z')).toBe(
            'future-date'
        );
    });

    it('반장(조기 마감)일 2026-11-27은 거래일이라 유지한다', () => {
        expect(dropReason('2026-11-27', '2026-11-27T19:00:00Z')).toBeNull();
    });

    it('서머타임 전환 일요일 2026-03-08은 버리고 다음 월요일 03-09는 유지한다', () => {
        expect(dropReason('2026-03-08', '2026-03-09T04:30:00Z')).toBe(
            'non-trading-day'
        );
        expect(dropReason('2026-03-09', '2026-03-09T15:00:00Z')).toBeNull();
    });

    it('24시간 시장(always-open)은 판정하지 않는다', () => {
        expect(
            liveDailyBarDropReason(
                dailyBar('2026-11-29'),
                { kind: 'always-open' } as never,
                new Date('2026-11-30T02:30:00Z')
            )
        ).toBeNull();
    });
});

describe('keepLiveDailyBar', () => {
    let warn: ReturnType<typeof vi.spyOn>;
    beforeEach(() => {
        warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    });
    afterEach(() => warn.mockRestore());

    it('거를 때는 null과 함께 심볼·사유·날짜를 로그한다', () => {
        const now = new Date('2026-11-30T02:30:00Z');
        expect(
            keepLiveDailyBar(
                dailyBar('2026-11-29'),
                US_EQUITY_SESSION,
                now,
                'AAPL'
            )
        ).toBeNull();
        expect(warn).toHaveBeenCalledWith(
            expect.stringContaining('live daily bar dropped'),
            'AAPL',
            'non-trading-day',
            '2026-11-29'
        );
    });

    it('통과하면 같은 봉을 돌려주고 로그하지 않는다', () => {
        const kept = dailyBar('2026-12-01');
        expect(
            keepLiveDailyBar(
                kept,
                US_EQUITY_SESSION,
                new Date('2026-12-01T15:00:00Z'),
                'AAPL'
            )
        ).toBe(kept);
        expect(warn).not.toHaveBeenCalled();
    });

    it('한국 세션은 KRX 달력으로 판정한다(미국 휴장일 날짜의 KRX 봉 유지)', () => {
        const kept = dailyBar('2026-11-26');
        expect(
            keepLiveDailyBar(
                kept,
                KR_EQUITY_SESSION,
                new Date('2026-11-26T05:00:00Z'),
                '005930.KS'
            )
        ).toBe(kept);
    });
});
