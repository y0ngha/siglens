import { describe, expect, it } from 'vitest';
import { FEAR_GREED_DATA_REWRITES } from '@/shared/config/fearGreedData';
import nextConfig from '../../../next.config';

describe('nextConfig 공포·탐욕 데이터 rewrite', () => {
    it('여섯 개 공개 경로를 모두 라우트 핸들러로 보낸다', async () => {
        const rewrites = await nextConfig.rewrites?.();

        expect(FEAR_GREED_DATA_REWRITES).toHaveLength(6);
        FEAR_GREED_DATA_REWRITES.forEach(entry => {
            expect(rewrites).toContainEqual(entry);
        });
    });
});
