import { buildShareUrl } from '@/features/share/lib/shareUrl';
import { SITE_URL } from '@/shared/lib/seo';

describe('buildShareUrl', () => {
    it('기본 로케일은 접두사 없는 /share 경로다', () => {
        expect(buildShareUrl('ko', 'abc123')).toBe(`${SITE_URL}/share/abc123`);
    });

    it('비기본 로케일은 로케일 접두사를 유지한다', () => {
        expect(buildShareUrl('ja', 'abc123')).toBe(
            `${SITE_URL}/ja/share/abc123`
        );
    });
});
