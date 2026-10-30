import {
    listCreateStatusNotices,
    type CreateStatusInput,
} from '@/features/siglens-api-key-management/lib/createStatusNotices';

const READY: CreateStatusInput = {
    hasError: false,
    emailVerified: true,
    limitReached: false,
    hasByokKey: true,
};

describe('listCreateStatusNotices', () => {
    it('발급할 수 있고 BYOK 키도 있으면 아무 안내도 없다', () => {
        expect(listCreateStatusNotices(READY)).toEqual([]);
    });

    it('BYOK 키가 없으면 BYOK 안내를 띄운다', () => {
        expect(
            listCreateStatusNotices({ ...READY, hasByokKey: false })
        ).toEqual(['byokNotice']);
    });

    it('이메일 미인증이면 인증 안내만 띄우고 BYOK 안내는 미룬다', () => {
        expect(
            listCreateStatusNotices({
                ...READY,
                emailVerified: false,
                hasByokKey: false,
            })
        ).toEqual(['emailNotVerified']);
    });

    it('상한에 닿으면 상한 안내를 띄우고 BYOK 안내는 미룬다', () => {
        expect(
            listCreateStatusNotices({
                ...READY,
                limitReached: true,
                hasByokKey: false,
            })
        ).toEqual(['limitHint']);
    });

    it('상한에서 발급 오류가 나면 오류만 띄운다', () => {
        expect(
            listCreateStatusNotices({
                ...READY,
                limitReached: true,
                hasError: true,
            })
        ).toEqual(['error']);
    });

    it('오류는 다른 안내보다 앞에 쌓인다', () => {
        expect(
            listCreateStatusNotices({
                ...READY,
                hasError: true,
                emailVerified: false,
            })
        ).toEqual(['error', 'emailNotVerified']);
    });
});
