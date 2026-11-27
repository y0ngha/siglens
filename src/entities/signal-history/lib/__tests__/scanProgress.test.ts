import type { ScanCursor } from '../../types';
import { applyScanAttempts, summarizeSession } from '../scanProgress';

const SESSION = '2026-11-20';

function cursor(overrides: Partial<ScanCursor> = {}): ScanCursor {
    return {
        lastSession: '2026-11-19',
        attemptSession: null,
        attempts: 0,
        lastOutcome: 'recorded',
        ...overrides,
    };
}

describe('applyScanAttempts', () => {
    it('기록되면 마지막 세션이 오르고 시도 횟수가 지워진다', () => {
        const next = applyScanAttempts(
            new Map([
                [
                    'A',
                    cursor({
                        attemptSession: SESSION,
                        attempts: 2,
                        lastOutcome: 'failed',
                    }),
                ],
            ]),
            SESSION,
            [{ symbol: 'A', outcome: 'recorded' }]
        );

        expect(next.get('A')).toEqual({
            lastSession: SESSION,
            attemptSession: null,
            attempts: 0,
            lastOutcome: 'recorded',
        });
    });

    it('같은 세션의 실패는 시도 횟수를 늘리고 마지막 세션은 그대로 둔다', () => {
        const next = applyScanAttempts(
            new Map([
                [
                    'A',
                    cursor({
                        attemptSession: SESSION,
                        attempts: 1,
                        lastOutcome: 'failed',
                    }),
                ],
            ]),
            SESSION,
            [{ symbol: 'A', outcome: 'stale' }]
        );

        expect(next.get('A')).toEqual({
            lastSession: '2026-11-19',
            attemptSession: SESSION,
            attempts: 2,
            lastOutcome: 'stale',
        });
    });

    it('다른 세션의 시도는 1부터 다시 센다', () => {
        const next = applyScanAttempts(
            new Map([
                ['A', cursor({ attemptSession: '2026-11-19', attempts: 3 })],
            ]),
            SESSION,
            [{ symbol: 'A', outcome: 'failed' }]
        );

        expect(next.get('A')?.attempts).toBe(1);
    });

    it('표식이 없던 종목의 실패는 마지막 세션 null로 시작한다', () => {
        const next = applyScanAttempts(new Map(), SESSION, [
            { symbol: 'NEW', outcome: 'failed' },
        ]);

        expect(next.get('NEW')).toEqual({
            lastSession: null,
            attemptSession: SESSION,
            attempts: 1,
            lastOutcome: 'failed',
        });
    });

    it('DB에 써지지 않은 실패 시도(persisted false)는 접지 않는다 — 세션이 써지지 않은 시도로 완료되지 않게', () => {
        const before = new Map([
            [
                'A',
                cursor({
                    attemptSession: SESSION,
                    attempts: 2,
                    lastOutcome: 'failed',
                }),
            ],
        ]);

        const next = applyScanAttempts(before, SESSION, [
            { symbol: 'A', outcome: 'failed', persisted: false },
        ]);

        expect(next.get('A')?.attempts).toBe(2);
        expect(summarizeSession(['A'], next, SESSION, 3).allSettled).toBe(
            false
        );
    });

    it('persisted true인 실패 시도는 접는다', () => {
        const next = applyScanAttempts(new Map(), SESSION, [
            { symbol: 'A', outcome: 'stale', persisted: true },
        ]);

        expect(next.get('A')?.attempts).toBe(1);
    });

    it('시도하지 않은 종목은 건드리지 않는다', () => {
        const untouched = cursor();
        const next = applyScanAttempts(new Map([['B', untouched]]), SESSION, [
            { symbol: 'A', outcome: 'recorded' },
        ]);

        expect(next.get('B')).toBe(untouched);
    });
});

describe('summarizeSession', () => {
    it('기록·실패·낡은 데이터를 세고, 모두 정리되면 allSettled다', () => {
        const cursors = new Map<string, ScanCursor>([
            ['A', cursor({ lastSession: SESSION })],
            [
                'B',
                cursor({
                    attemptSession: SESSION,
                    attempts: 3,
                    lastOutcome: 'stale',
                }),
            ],
            [
                'C',
                cursor({
                    lastSession: null,
                    attemptSession: SESSION,
                    attempts: 3,
                    lastOutcome: 'failed',
                }),
            ],
        ]);

        expect(summarizeSession(['A', 'B', 'C'], cursors, SESSION, 3)).toEqual({
            recorded: 1,
            failed: 1,
            stale: 1,
            settledFailed: 2,
            allSettled: true,
        });
    });

    it('시도가 남은 종목이나 표식이 없는 종목이 있으면 아직 끝나지 않았다', () => {
        const cursors = new Map<string, ScanCursor>([
            ['A', cursor({ lastSession: SESSION })],
            [
                'B',
                cursor({
                    attemptSession: SESSION,
                    attempts: 1,
                    lastOutcome: 'failed',
                }),
            ],
        ]);

        expect(
            summarizeSession(['A', 'B', 'NEW'], cursors, SESSION, 3)
        ).toEqual({
            recorded: 1,
            failed: 1,
            stale: 0,
            settledFailed: 0,
            allSettled: false,
        });
    });

    it('이전 세션의 실패는 이번 세션 집계에 들지 않는다', () => {
        const cursors = new Map<string, ScanCursor>([
            [
                'A',
                cursor({
                    attemptSession: '2026-11-19',
                    attempts: 3,
                    lastOutcome: 'failed',
                }),
            ],
        ]);

        expect(summarizeSession(['A'], cursors, SESSION, 3)).toMatchObject({
            failed: 0,
            allSettled: false,
        });
    });

    it('이미 기록된 종목은 이전 실패 이력이 남아 있어도 기록으로만 센다', () => {
        const cursors = new Map<string, ScanCursor>([
            [
                'A',
                cursor({
                    lastSession: SESSION,
                    attemptSession: SESSION,
                    attempts: 1,
                    lastOutcome: 'failed',
                }),
            ],
        ]);

        expect(summarizeSession(['A'], cursors, SESSION, 3)).toMatchObject({
            recorded: 1,
            failed: 0,
        });
    });
});
