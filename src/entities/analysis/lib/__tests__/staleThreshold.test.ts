import { CRYPTO_SESSION, US_EQUITY_SESSION } from '@y0ngha/siglens-core';
import { KR_EQUITY_SESSION } from '@/shared/api/market/sessionSpecFor';
import {
    isAnalysisStale,
    STALE_THRESHOLD_MS,
} from '@/entities/analysis/lib/staleThreshold';
import { MS_PER_MINUTE } from '@/shared/config/time';

describe('isAnalysisStale', () => {
    const now = new Date('2026-05-22T12:00:00.000Z');

    it('returns false when analyzed within threshold (1Day, 3h ago)', () => {
        const analyzedAt = new Date('2026-05-22T09:00:00.000Z').toISOString();
        expect(isAnalysisStale(analyzedAt, '1Day', now)).toBe(false);
    });

    it('returns true when analyzed beyond threshold (1Day, 5h ago)', () => {
        const analyzedAt = new Date('2026-05-22T07:00:00.000Z').toISOString();
        expect(isAnalysisStale(analyzedAt, '1Day', now)).toBe(true);
    });

    it('returns false at the exact boundary (1Day — strict >)', () => {
        const analyzedAt = new Date(
            now.getTime() - STALE_THRESHOLD_MS['1Day']
        ).toISOString();
        expect(isAnalysisStale(analyzedAt, '1Day', now)).toBe(false);
    });

    it('returns false when analyzed within threshold (1Hour, 29min ago)', () => {
        const analyzedAt = new Date(
            now.getTime() - STALE_THRESHOLD_MS['1Hour'] + MS_PER_MINUTE
        ).toISOString();
        expect(isAnalysisStale(analyzedAt, '1Hour', now)).toBe(false);
    });

    it('returns true when analyzed beyond threshold (4Hour, boundary + 1min)', () => {
        const analyzedAt = new Date(
            now.getTime() - STALE_THRESHOLD_MS['4Hour'] - MS_PER_MINUTE
        ).toISOString();
        expect(isAnalysisStale(analyzedAt, '4Hour', now)).toBe(true);
    });

    it('returns true when analyzed beyond threshold (5Min, 10min ago)', () => {
        const analyzedAt = new Date('2026-05-22T11:50:00.000Z').toISOString();
        expect(isAnalysisStale(analyzedAt, '5Min', now)).toBe(true);
    });

    it('returns true when analyzed beyond threshold (15Min, boundary + 1min)', () => {
        const analyzedAt = new Date(
            now.getTime() - STALE_THRESHOLD_MS['15Min'] - MS_PER_MINUTE
        ).toISOString();
        expect(isAnalysisStale(analyzedAt, '15Min', now)).toBe(true);
    });

    it('returns false when analyzed within threshold (30Min, boundary - 1min)', () => {
        const analyzedAt = new Date(
            now.getTime() - STALE_THRESHOLD_MS['30Min'] + MS_PER_MINUTE
        ).toISOString();
        expect(isAnalysisStale(analyzedAt, '30Min', now)).toBe(false);
    });

    it('returns false for invalid ISO input', () => {
        expect(isAnalysisStale('not-a-date', '1Day', now)).toBe(false);
    });
});

describe('isAnalysisStale — 시장 세션 반영', () => {
    // 2026-07-xx는 EDT(UTC-4): 정규장 13:30~20:00 UTC. 2026-01-xx는 EST(UTC-5): 14:30~21:00 UTC.
    const stale = (
        analyzed: string,
        timeframe: Parameters<typeof isAnalysisStale>[1],
        now: string,
        session = US_EQUITY_SESSION
    ): boolean => isAnalysisStale(analyzed, timeframe, new Date(now), session);

    describe('1Day', () => {
        // 2026-07-14(화)는 EDT: 정규장 13:30~20:00 UTC.
        it('경계: 전날 마감 뒤 분석을 오늘 개장 1분 뒤에 열면 오래됐다(장중이고 4시간 초과)', () => {
            expect(
                stale('2026-07-13T21:00:00Z', '1Day', '2026-07-14T13:31:00Z')
            ).toBe(true);
        });

        it('경계: 장중 2시간 전 분석은 오래되지 않았다', () => {
            expect(
                stale('2026-07-14T15:00:00Z', '1Day', '2026-07-14T17:00:00Z')
            ).toBe(false);
        });

        it('경계: 장중 5시간 전 분석은 아직 장이 열려 있으면 오래됐다', () => {
            expect(
                stale('2026-07-14T14:00:00Z', '1Day', '2026-07-14T19:00:00Z')
            ).toBe(true);
        });

        it('경계: 오늘 프리마켓에 한 분석(4시간 이내)은 개장 직후에도 오래되지 않았다', () => {
            expect(
                stale('2026-07-14T12:00:00Z', '1Day', '2026-07-14T13:31:00Z')
            ).toBe(false);
        });

        it('금요일 마감 후 분석은 주말 내내 오래되지 않았다', () => {
            // 금 21:00 UTC(마감 20:00 후)에 분석, 일요일 15:00 UTC.
            expect(
                stale('2026-07-10T21:00:00Z', '1Day', '2026-07-12T15:00:00Z')
            ).toBe(false);
        });

        it('같은 날 마감 후 저녁에는 4시간이 지나도 오래되지 않았다', () => {
            // 화 20:30 UTC(마감 20:00 직후) 분석, 수 02:00 UTC에 열람 — 5.5시간이 지나 시계로는
            // 4시간을 넘지만, 그 사이 장이 계속 닫혀 있어 새 봉이 없으므로 오래되지 않았다.
            expect(
                stale('2026-07-14T20:30:00Z', '1Day', '2026-07-15T02:00:00Z')
            ).toBe(false);
        });

        it('장중 분석 뒤 마감이 지나면 오래됐다(새 일봉 완성)', () => {
            expect(
                stale('2026-07-14T15:00:00Z', '1Day', '2026-07-14T20:30:00Z')
            ).toBe(true);
        });

        it('월요일 개장 전에는 금요일 마감 후 분석이 오래되지 않았다', () => {
            expect(
                stale('2026-07-10T22:00:00Z', '1Day', '2026-07-13T12:00:00Z')
            ).toBe(false);
        });

        it('장이 열려 있고 4시간을 넘기면 오래됐다', () => {
            // 월 개장 후 분석(14:00 UTC)... 마감 이후 분석이 개장 후 4h 초과.
            expect(
                stale('2026-07-14T13:40:00Z', '1Day', '2026-07-14T18:00:00Z')
            ).toBe(true);
        });

        it('장이 열려 있고 4시간 이내면 오래되지 않았다', () => {
            expect(
                stale('2026-07-14T14:00:00Z', '1Day', '2026-07-14T17:00:00Z')
            ).toBe(false);
        });

        it('전날 마감 후 분석을 다음 날 장중에 열면(4h 초과) 오래됐다', () => {
            expect(
                stale('2026-07-13T21:00:00Z', '1Day', '2026-07-14T18:00:00Z')
            ).toBe(true);
        });

        it('조기 마감일(13:00 ET 반장)에는 마감 뒤 열람하면 오래됐다', () => {
            // 2026-11-27(추수감사절 다음 금요일)은 13:00 ET(18:00 UTC) 조기 마감. 12:00 ET(17:00 UTC)
            // 분석을 14:00 ET(19:00 UTC)에 열면, 정규 마감(16:00 ET)이 아닌 조기 마감이 기준이라 오래됐다.
            expect(
                stale('2026-11-27T17:00:00Z', '1Day', '2026-11-27T19:00:00Z')
            ).toBe(true);
        });

        it('서머타임이 아닌 겨울(EST)에도 마감 경계를 정확히 따른다', () => {
            // 21:00 UTC가 마감. 20:59 분석은 마감 전, 21:01 분석은 마감 후.
            expect(
                stale('2026-01-13T20:59:00Z', '1Day', '2026-01-13T23:00:00Z')
            ).toBe(true);
            expect(
                stale('2026-01-13T21:01:00Z', '1Day', '2026-01-13T23:00:00Z')
            ).toBe(false);
        });

        it('휴장일(독립기념일 대체 휴장 7/3)에는 새 봉이 없어 오래되지 않았다', () => {
            // 2026-07-03(금)은 NYSE 휴장. 목 마감 후 분석을 금 낮에 본다.
            expect(
                stale('2026-07-02T21:00:00Z', '1Day', '2026-07-03T15:00:00Z')
            ).toBe(false);
        });

        it('한국장: 마감(06:30 UTC) 후 분석은 저녁에 오래되지 않았다', () => {
            expect(
                stale(
                    '2026-07-14T07:00:00Z',
                    '1Day',
                    '2026-07-14T14:00:00Z',
                    KR_EQUITY_SESSION
                )
            ).toBe(false);
        });

        it('한국장: 장중 분석 뒤 마감이 지나면 오래됐다', () => {
            expect(
                stale(
                    '2026-07-14T02:00:00Z',
                    '1Day',
                    '2026-07-14T07:00:00Z',
                    KR_EQUITY_SESSION
                )
            ).toBe(true);
        });
    });

    describe('1Week — 일봉과 같은 규칙', () => {
        it('장중 5시간 전 분석은 열려 있으면 오래됐다(임계값 4시간)', () => {
            expect(STALE_THRESHOLD_MS['1Week']).toBe(
                STALE_THRESHOLD_MS['1Day']
            );
            expect(
                stale('2026-07-14T14:00:00Z', '1Week', '2026-07-14T19:00:00Z')
            ).toBe(true);
        });

        it('같은 날 마감 후 저녁에는 4시간이 지나도 오래되지 않았다', () => {
            expect(
                stale('2026-07-14T20:30:00Z', '1Week', '2026-07-15T02:00:00Z')
            ).toBe(false);
        });

        it('장중 분석 뒤 마감이 지나면 오래됐다(진행 중인 주봉이 움직였다)', () => {
            expect(
                stale('2026-07-14T15:00:00Z', '1Week', '2026-07-14T20:30:00Z')
            ).toBe(true);
        });

        it('금요일 마감 후 분석은 주말 내내 오래되지 않았다', () => {
            expect(
                stale('2026-07-10T21:00:00Z', '1Week', '2026-07-12T15:00:00Z')
            ).toBe(false);
        });
    });

    describe('분·시간봉', () => {
        it('장이 닫혀 있고 분석이 마지막 마감 뒤면 오래되지 않았다', () => {
            expect(
                stale('2026-07-14T20:05:00Z', '5Min', '2026-07-15T02:00:00Z')
            ).toBe(false);
        });

        it('장이 닫혀 있고 분석이 마지막 마감 전이면 오래됐다', () => {
            expect(
                stale('2026-07-14T19:00:00Z', '1Hour', '2026-07-14T20:30:00Z')
            ).toBe(true);
        });

        it('장중에는 시계 임계값을 쓴다(5분봉, 10분 전이면 오래됨)', () => {
            expect(
                stale('2026-07-14T15:00:00Z', '5Min', '2026-07-14T15:10:00Z')
            ).toBe(true);
        });

        it('장중에 임계값 이내면 오래되지 않았다', () => {
            expect(
                stale('2026-07-14T15:00:00Z', '5Min', '2026-07-14T15:03:00Z')
            ).toBe(false);
        });

        it('주말에는 금요일 마감 뒤 분석이 오래되지 않았다', () => {
            expect(
                stale('2026-07-10T20:10:00Z', '4Hour', '2026-07-12T15:00:00Z')
            ).toBe(false);
        });
    });

    describe('24/7 시장', () => {
        it('크립토는 시계 임계값을 그대로 쓴다(1Day 5시간 전이면 오래됨)', () => {
            expect(
                stale(
                    '2026-07-12T07:00:00Z',
                    '1Day',
                    '2026-07-12T12:00:00Z',
                    CRYPTO_SESSION
                )
            ).toBe(true);
        });

        it('크립토는 임계값 이내면 오래되지 않았다', () => {
            expect(
                stale(
                    '2026-07-12T10:00:00Z',
                    '1Day',
                    '2026-07-12T12:00:00Z',
                    CRYPTO_SESSION
                )
            ).toBe(false);
        });
    });

    it('session이 없으면 기존 시계 판정이다', () => {
        expect(
            isAnalysisStale(
                '2026-07-10T21:00:00Z',
                '1Day',
                new Date('2026-07-12T15:00:00Z')
            )
        ).toBe(true);
    });

    it('파싱할 수 없는 analyzedAt은 세션이 있어도 false다', () => {
        expect(
            isAnalysisStale(
                'nope',
                '1Day',
                new Date('2026-07-12T15:00:00Z'),
                US_EQUITY_SESSION
            )
        ).toBe(false);
    });
});
