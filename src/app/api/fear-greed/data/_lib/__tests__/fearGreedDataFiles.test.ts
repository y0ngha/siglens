import { describe, expect, it } from 'vitest';
import { scoredHistory } from '@/__tests__/utils/marketFearGreedHubView';
import { scoredReadings } from '@/entities/market-fear-greed/lib/publishableHistory';
import { SITE_URL } from '@/shared/lib/seo';
import {
    FEAR_GREED_DATA_CACHE_CONTROL,
    toFearGreedCsv,
    toFearGreedJson,
} from '../fearGreedDataFiles';

// 중간 빈 날(11-04)은 검증 단계(`scoredReadings`)에서 이미 빠진 점 목록이다.
const POINTS = scoredReadings([
    { date: '2026-11-03', score: 43, label: 'FEAR' },
    { date: '2026-11-04', score: null, label: null },
    { date: '2026-11-05', score: 51, label: 'NEUTRAL' },
]);

describe('toFearGreedCsv', () => {
    it('헤더와 점을 오름차순으로 싣는다', () => {
        expect(toFearGreedCsv(POINTS)).toBe(
            'date,score,label\n2026-11-03,43,FEAR\n2026-11-05,51,NEUTRAL\n'
        );
    });

    it('BOM과 CR이 없다', () => {
        const csv = toFearGreedCsv(
            scoredReadings(scoredHistory(25, '2026-11-05'))
        );
        expect(csv.charCodeAt(0)).not.toBe(0xfeff);
        expect(csv).not.toContain('\r');
        expect(csv.endsWith('\n')).toBe(true);
    });
});

describe('toFearGreedJson', () => {
    it.each([
        ['us', 'America/New_York', '/fear-greed'],
        ['kr', 'Asia/Seoul', '/fear-greed/kr'],
        ['crypto', 'UTC', '/fear-greed/crypto'],
    ] as const)('%s 파일 객체를 만든다', (market, dateTimeZone, hub) => {
        expect(
            toFearGreedJson(market, { asOf: '2026-11-05', points: POINTS })
        ).toEqual({
            schemaVersion: 1,
            market,
            asOf: '2026-11-05',
            dateTimeZone,
            scoreRange: { min: 0, max: 100 },
            source: `${SITE_URL}${hub}`,
            methodology: `${SITE_URL}/methodology#fear-greed`,
            license: `${SITE_URL}/terms`,
            points: [
                { date: '2026-11-03', score: 43, label: 'FEAR' },
                { date: '2026-11-05', score: 51, label: 'NEUTRAL' },
            ],
        });
    });
});

describe('FEAR_GREED_DATA_CACHE_CONTROL', () => {
    it('1시간 신선 + 1시간 stale이다', () => {
        expect(FEAR_GREED_DATA_CACHE_CONTROL).toBe(
            'public, max-age=3600, stale-while-revalidate=3600'
        );
    });
});
