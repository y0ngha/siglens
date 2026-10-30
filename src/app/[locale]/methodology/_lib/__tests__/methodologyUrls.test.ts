import { METHODOLOGY_PAGE_URL } from '@/app/[locale]/methodology/_lib/methodologyUrls';

describe('methodology URL', () => {
    it('절대 URL은 로케일 접두사 없는 /methodology다', () => {
        expect(METHODOLOGY_PAGE_URL).toBe('https://siglens.io/methodology');
    });
});
