import { describe, expect, it } from 'vitest';
import { fearGreedCopyFor } from '@/app/[locale]/fear-greed/copy';
import type { FearGreedMarketId } from '@/shared/lib/marketFearGreedLabels';
import {
    FEAR_GREED_DATA_MARKETS,
    FEAR_GREED_DATA_REWRITES,
    FEAR_GREED_HUB_PATH,
    fearGreedDataApiPath,
    fearGreedDataFileName,
    fearGreedDataPath,
    parseFearGreedDataParams,
} from '../fearGreedData';

describe('fearGreedData', () => {
    it('여섯 개 공개 경로와 rewrite 목적지를 만든다', () => {
        expect(FEAR_GREED_DATA_REWRITES).toEqual([
            {
                source: '/fear-greed/data.csv',
                destination: '/api/fear-greed/data/us/csv',
            },
            {
                source: '/fear-greed/data.json',
                destination: '/api/fear-greed/data/us/json',
            },
            {
                source: '/fear-greed/kr/data.csv',
                destination: '/api/fear-greed/data/kr/csv',
            },
            {
                source: '/fear-greed/kr/data.json',
                destination: '/api/fear-greed/data/kr/json',
            },
            {
                source: '/fear-greed/crypto/data.csv',
                destination: '/api/fear-greed/data/crypto/csv',
            },
            {
                source: '/fear-greed/crypto/data.json',
                destination: '/api/fear-greed/data/crypto/json',
            },
        ]);
    });

    it('경로·API 경로·파일 이름 헬퍼가 같은 시장·형식을 가리킨다', () => {
        expect(fearGreedDataPath('kr', 'csv')).toBe('/fear-greed/kr/data.csv');
        expect(fearGreedDataApiPath('crypto', 'json')).toBe(
            '/api/fear-greed/data/crypto/json'
        );
        expect(fearGreedDataFileName('us', 'json')).toBe(
            'siglens-fear-greed-us.json'
        );
    });

    describe('parseFearGreedDataParams', () => {
        it.each([
            ['us', 'csv'],
            ['us', 'json'],
            ['kr', 'csv'],
            ['kr', 'json'],
            ['crypto', 'csv'],
            ['crypto', 'json'],
        ] as const)('%s/%s를 받아들인다', (market, format) => {
            expect(parseFearGreedDataParams(market, format)).toEqual({
                market,
                format,
            });
        });

        it.each([
            ['jp', 'csv'],
            ['us', 'xml'],
            ['US', 'csv'],
            ['us', 'CSV'],
        ])('%s/%s는 거절한다', (market, format) => {
            expect(parseFearGreedDataParams(market, format)).toBeNull();
        });
    });

    it.each(FEAR_GREED_DATA_MARKETS)(
        '%s 허브 경로가 라우트 카피의 path와 같다',
        market => {
            expect(FEAR_GREED_HUB_PATH[market]).toBe(
                fearGreedCopyFor(market, key => key).path
            );
        }
    );

    it('시장 목록이 FearGreedMarketId와 같은 집합이다', () => {
        const ids = [
            'us',
            'kr',
            'crypto',
        ] as const satisfies readonly FearGreedMarketId[];
        // 반대 방향: 유니온에 시장이 늘면 아래 Record가 컴파일 단계에서 깨진다.
        const record = {
            us: true,
            kr: true,
            crypto: true,
        } satisfies Record<FearGreedMarketId, true>;
        expect([...FEAR_GREED_DATA_MARKETS].sort()).toEqual([...ids].sort());
        expect(Object.keys(record)).toHaveLength(
            FEAR_GREED_DATA_MARKETS.length
        );
    });
});
