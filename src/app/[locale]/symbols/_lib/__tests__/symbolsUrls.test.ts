import { SYMBOLS_PAGE_URL } from '@/app/[locale]/symbols/_lib/symbolsUrls';

describe('symbols URL', () => {
    it('절대 URL은 로케일 접두사 없는 /symbols다', () => {
        expect(SYMBOLS_PAGE_URL).toBe('https://siglens.io/symbols');
    });
});
