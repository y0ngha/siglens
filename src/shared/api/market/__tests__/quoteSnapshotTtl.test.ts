import { describe, expect, it } from 'vitest';
import {
    QUOTE_SNAPSHOT_MAX_TTL_SECONDS,
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
