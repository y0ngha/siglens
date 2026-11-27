import { KR_EQUITY_SESSION } from '@/shared/api/market/sessionSpecFor';
import { US_EQUITY_SESSION } from '@y0ngha/siglens-core';
import type { ScanCursor } from '../../types';
import { isSymbolSettled, scanDayCount, scanModeFor } from '../scanMode';
import { SIGNAL_HISTORY_BOOTSTRAP_SESSIONS } from '../signalScanConstants';

function cursor(overrides: Partial<ScanCursor> = {}): ScanCursor {
    return {
        lastSession: '2026-11-19',
        attemptSession: null,
        attempts: 0,
        lastOutcome: 'recorded',
        ...overrides,
    };
}

describe('scanModeFor', () => {
    it('진행 표식이 없으면 처음 기록하는 종목이다', () => {
        expect(scanModeFor(undefined, US_EQUITY_SESSION, '2026-11-20')).toBe(
            'bootstrap'
        );
    });

    it('표식은 있지만 한 번도 성공하지 못했으면(last_session null) 처음 기록하는 종목이다', () => {
        expect(
            scanModeFor(
                cursor({ lastSession: null, lastOutcome: 'failed' }),
                US_EQUITY_SESSION,
                '2026-11-20'
            )
        ).toBe('bootstrap');
    });

    it('직전 거래 세션까지 기록돼 있으면 하루만이다 — 주말을 건너뛴 월요일도 금요일까지면 하루다', () => {
        expect(
            scanModeFor(
                cursor({ lastSession: '2026-11-13' }),
                US_EQUITY_SESSION,
                '2026-11-16'
            )
        ).toBe('normal');
    });

    it('직전 거래 세션보다 뒤처졌으면 따라잡는다', () => {
        expect(
            scanModeFor(
                cursor({ lastSession: '2026-11-12' }),
                US_EQUITY_SESSION,
                '2026-11-16'
            )
        ).toBe('catch_up');
    });

    it('한국 달력의 직전 세션을 쓴다(미국 달력으로 되감지 않는다)', () => {
        expect(
            scanModeFor(
                cursor({ lastSession: '2026-11-19' }),
                KR_EQUITY_SESSION,
                '2026-11-20'
            )
        ).toBe('normal');
    });
});

describe('isSymbolSettled', () => {
    const SESSION = '2026-11-20';

    it('표식이 없으면 정리되지 않았다', () => {
        expect(isSymbolSettled(undefined, SESSION, 3)).toBe(false);
    });

    it('그 세션 이상까지 기록됐으면 정리됐다', () => {
        expect(
            isSymbolSettled(cursor({ lastSession: SESSION }), SESSION, 3)
        ).toBe(true);
    });

    it('이전 세션까지만 기록됐으면 정리되지 않았다', () => {
        expect(isSymbolSettled(cursor(), SESSION, 3)).toBe(false);
    });

    it('이 세션의 시도를 다 썼으면 기록이 없어도 정리됐다', () => {
        expect(
            isSymbolSettled(
                cursor({
                    attemptSession: SESSION,
                    attempts: 3,
                    lastOutcome: 'stale',
                }),
                SESSION,
                3
            )
        ).toBe(true);
    });

    it('시도 횟수가 남았거나 다른 세션의 시도면 정리되지 않았다', () => {
        expect(
            isSymbolSettled(
                cursor({ attemptSession: SESSION, attempts: 2 }),
                SESSION,
                3
            )
        ).toBe(false);
        expect(
            isSymbolSettled(
                cursor({ attemptSession: '2026-11-19', attempts: 3 }),
                SESSION,
                3
            )
        ).toBe(false);
    });

    it('한 번도 성공하지 못한 종목도 시도를 다 쓰면 정리된다', () => {
        expect(
            isSymbolSettled(
                cursor({
                    lastSession: null,
                    attemptSession: SESSION,
                    attempts: 3,
                    lastOutcome: 'failed',
                }),
                SESSION,
                3
            )
        ).toBe(true);
    });
});

describe('scanDayCount', () => {
    const dates = Array.from({ length: 300 }, (_, i) =>
        new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10)
    );

    it('normal은 하루다', () => {
        expect(scanDayCount('normal', dates, '2026-10-26')).toBe(1);
    });

    it('bootstrap은 120일이고, 봉이 모자라면 있는 만큼이다', () => {
        expect(scanDayCount('bootstrap', dates, null)).toBe(
            SIGNAL_HISTORY_BOOTSTRAP_SESSIONS
        );
        expect(scanDayCount('bootstrap', dates.slice(0, 40), null)).toBe(40);
    });

    it('catch_up은 마지막 기록 이후 봉 수다', () => {
        expect(scanDayCount('catch_up', dates, dates[296] ?? null)).toBe(3);
    });

    it('catch_up도 120일을 넘기지 않는다', () => {
        expect(scanDayCount('catch_up', dates, dates[10] ?? null)).toBe(
            SIGNAL_HISTORY_BOOTSTRAP_SESSIONS
        );
    });

    it('봉이 없으면 0이다', () => {
        expect(scanDayCount('normal', [], null)).toBe(0);
    });
});
