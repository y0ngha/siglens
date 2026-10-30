import { DEVELOPERS_PAGE_URL } from '@/app/[locale]/developers/_lib/developersUrls';

describe('developers URL', () => {
    it('절대 URL은 로케일 접두사 없는 /developers다', () => {
        expect(DEVELOPERS_PAGE_URL).toBe('https://siglens.io/developers');
    });
});
