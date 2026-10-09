import path from 'path';
import { loadGuideSeed } from '@/../db/scripts/lib/guideSeed';

describe('db/seeds/guide (real files)', () => {
    it('모든 시드가 파싱·검증을 통과한다 (ko 필수, related 유효, 카테고리 일치)', async () => {
        const seed = await loadGuideSeed(
            path.resolve(process.cwd(), 'db/seeds/guide')
        );

        expect(seed.entries).toHaveLength(90);
    });
});
