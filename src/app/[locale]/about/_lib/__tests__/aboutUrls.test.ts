import { ABOUT_PAGE_URL } from '@/app/[locale]/about/_lib/aboutUrls';

describe('about URL', () => {
    it('절대 URL은 로케일 접두사 없는 /about다', () => {
        expect(ABOUT_PAGE_URL).toBe('https://siglens.io/about');
    });
});
