import { EMAIL_MAX_LENGTH } from '@/shared/config/email';

describe('EMAIL_MAX_LENGTH', () => {
    it('users.email·inquiries.email 컬럼 길이(320)를 고정한다', () => {
        expect(EMAIL_MAX_LENGTH).toBe(320);
    });
});
