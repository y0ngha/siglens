import { describe, expect, it } from 'vitest';
import {
    QUOTE_SNAPSHOT_MAX_TTL_SECONDS,
    quoteSnapshotTtlSeconds,
} from '@/shared/api/market/quoteSnapshotTtl';

describe('quoteSnapshotTtlSeconds', () => {
    it('장외 TTL(다음 개장까지)은 5분으로 자른다', () => {
        expect(quoteSnapshotTtlSeconds(17 * 3600)).toBe(
            QUOTE_SNAPSHOT_MAX_TTL_SECONDS
        );
    });

    it('주말 내내 이어지는 장외 TTL 상한(24시간)도 5분으로 자른다', () => {
        expect(quoteSnapshotTtlSeconds(24 * 3600)).toBe(5 * 60);
    });

    it('장중·크립토의 60초 TTL은 그대로다', () => {
        expect(quoteSnapshotTtlSeconds(60)).toBe(60);
    });
});
