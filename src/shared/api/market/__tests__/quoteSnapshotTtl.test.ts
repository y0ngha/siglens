import { describe, expect, it } from 'vitest';
import type { Bar } from '@y0ngha/siglens-core';
import {
    QUOTE_SNAPSHOT_MAX_TTL_SECONDS,
    isUsableSnapshot,
    quoteSnapshotTtlSeconds,
} from '@/shared/api/market/quoteSnapshotTtl';

describe('quoteSnapshotTtlSeconds', () => {
    it('장외 TTL(다음 개장까지, 주말엔 최대 24시간)을 상한으로 자른다', () => {
        expect(quoteSnapshotTtlSeconds(24 * 3600)).toBe(
            QUOTE_SNAPSHOT_MAX_TTL_SECONDS
        );
    });

    it('장중·크립토의 60초 TTL은 그대로다', () => {
        expect(quoteSnapshotTtlSeconds(60)).toBe(60);
    });
});

const BAR: Bar = {
    time: 1_767_312_000,
    open: 1,
    high: 1,
    low: 1,
    close: 1,
    volume: 1,
};

describe('isUsableSnapshot', () => {
    it('시세도 오늘 봉도 없는 스냅샷은 굳히지 않는다', () => {
        expect(isUsableSnapshot({ quote: null, todayBar: null })).toBe(false);
    });

    it('오늘 봉만 있는 스냅샷은 굳힌다', () => {
        expect(isUsableSnapshot({ quote: null, todayBar: BAR })).toBe(true);
    });
});
