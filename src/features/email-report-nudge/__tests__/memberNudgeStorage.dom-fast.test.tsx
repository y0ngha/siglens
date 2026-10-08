import {
    EMPTY_MEMBER_NUDGE_RECORD,
    type MemberNudgeRecord,
} from '@/features/email-report-nudge/lib/memberNudgePolicy';
import {
    readMemberNudgeRecord,
    writeMemberNudgeRecord,
} from '@/features/email-report-nudge/lib/memberNudgeStorage';
import { LOCAL_STORAGE_MEMBER_EMAIL_REPORT_NUDGE_KEY } from '@/shared/lib/storageKeys';

const RECORD: MemberNudgeRecord = {
    setupShown: true,
    symbolCounts: { TSLA: 2 },
    symbolsNudged: ['NVDA'],
    lastSymbolNudgeAt: 123,
};

describe('memberNudgeStorage', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('기록이 없으면 빈 기록이다', () => {
        expect(readMemberNudgeRecord('u-1')).toEqual(EMPTY_MEMBER_NUDGE_RECORD);
    });

    it('회원 id별로 나눠 저장하고 읽는다', () => {
        writeMemberNudgeRecord('u-1', RECORD);
        writeMemberNudgeRecord('u-2', EMPTY_MEMBER_NUDGE_RECORD);

        expect(readMemberNudgeRecord('u-1')).toEqual(RECORD);
        expect(readMemberNudgeRecord('u-2')).toEqual(EMPTY_MEMBER_NUDGE_RECORD);
    });

    it('모양이 틀린 기록은 빈 기록으로 본다', () => {
        localStorage.setItem(
            LOCAL_STORAGE_MEMBER_EMAIL_REPORT_NUDGE_KEY,
            JSON.stringify({ 'u-1': { setupShown: 'yes' } })
        );
        expect(readMemberNudgeRecord('u-1')).toEqual(EMPTY_MEMBER_NUDGE_RECORD);
    });

    it('깨진 JSON은 빈 기록으로 읽고, 다음 쓰기가 덮어써 복구된다', () => {
        localStorage.setItem(LOCAL_STORAGE_MEMBER_EMAIL_REPORT_NUDGE_KEY, '{{');
        expect(readMemberNudgeRecord('u-1')).toEqual(EMPTY_MEMBER_NUDGE_RECORD);

        writeMemberNudgeRecord('u-1', RECORD);
        expect(readMemberNudgeRecord('u-1')).toEqual(RECORD);
    });

    it('저장소가 막혀 있어도 던지지 않는다', () => {
        const spy = vi
            .spyOn(Storage.prototype, 'getItem')
            .mockImplementation(() => {
                throw new Error('blocked');
            });
        try {
            expect(readMemberNudgeRecord('u-1')).toEqual(
                EMPTY_MEMBER_NUDGE_RECORD
            );
            expect(() => writeMemberNudgeRecord('u-1', RECORD)).not.toThrow();
        } finally {
            spy.mockRestore();
        }
    });
});
