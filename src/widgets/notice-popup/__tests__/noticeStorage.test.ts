// @vitest-environment jsdom
import {
    DISMISSED_NOTICES_STORAGE_KEY,
    loadDismissedNoticeIds,
    dismissNotice,
} from '../utils/noticeStorage';

describe('noticeStorage', () => {
    let storageSpy: ReturnType<typeof vi.spyOn> | undefined;

    beforeEach(() => {
        localStorage.clear();
    });

    afterEach(() => {
        storageSpy?.mockRestore();
        storageSpy = undefined;
    });

    describe('loadDismissedNoticeIds', () => {
        it('저장된 값이 없으면 빈 배열을 반환한다', () => {
            expect(loadDismissedNoticeIds()).toEqual([]);
        });

        it('저장된 ID 배열을 반환한다', () => {
            localStorage.setItem(
                DISMISSED_NOTICES_STORAGE_KEY,
                JSON.stringify(['a', 'b'])
            );
            expect(loadDismissedNoticeIds()).toEqual(['a', 'b']);
        });

        it('JSON이 손상된 경우 빈 배열로 fallback한다', () => {
            localStorage.setItem(DISMISSED_NOTICES_STORAGE_KEY, '{not json');
            expect(loadDismissedNoticeIds()).toEqual([]);
        });

        it('배열이 아닌 값이 저장된 경우 빈 배열로 fallback한다', () => {
            localStorage.setItem(
                DISMISSED_NOTICES_STORAGE_KEY,
                JSON.stringify({ foo: 'bar' })
            );
            expect(loadDismissedNoticeIds()).toEqual([]);
        });

        it('버전 없는 레거시 배열 포맷도 계속 읽는다', () => {
            localStorage.setItem(
                DISMISSED_NOTICES_STORAGE_KEY,
                JSON.stringify(['legacy-a', 'legacy-b'])
            );
            expect(loadDismissedNoticeIds()).toEqual(['legacy-a', 'legacy-b']);
        });

        it('버전 필드가 있는 현재 포맷을 읽는다', () => {
            localStorage.setItem(
                DISMISSED_NOTICES_STORAGE_KEY,
                JSON.stringify({ v: 1, ids: ['a'] })
            );
            expect(loadDismissedNoticeIds()).toEqual(['a']);
        });

        it('모르는 버전은 폐기하고 빈 배열을 반환한다', () => {
            localStorage.setItem(
                DISMISSED_NOTICES_STORAGE_KEY,
                JSON.stringify({ v: 99, ids: ['a'] })
            );
            expect(loadDismissedNoticeIds()).toEqual([]);
        });

        it('문자열이 아닌 원소는 걸러낸다', () => {
            localStorage.setItem(
                DISMISSED_NOTICES_STORAGE_KEY,
                JSON.stringify(['a', 1, null, 'b'])
            );
            expect(loadDismissedNoticeIds()).toEqual(['a', 'b']);
        });
    });

    describe('dismissNotice', () => {
        it('새 ID를 추가 저장한다', () => {
            dismissNotice('x');
            expect(loadDismissedNoticeIds()).toEqual(['x']);
        });

        it('기존 ID에 누적한다', () => {
            dismissNotice('x');
            dismissNotice('y');
            expect(loadDismissedNoticeIds()).toEqual(['x', 'y']);
        });

        it('중복 ID는 다시 저장하지 않는다', () => {
            dismissNotice('x');
            dismissNotice('x');
            expect(loadDismissedNoticeIds()).toEqual(['x']);
        });

        it('setItem이 throw해도(quota 초과 등) 예외를 전파하지 않는다', () => {
            storageSpy = vi
                .spyOn(Storage.prototype, 'setItem')
                .mockImplementation(() => {
                    throw new Error('QuotaExceededError');
                });
            const warnSpy = vi
                .spyOn(console, 'warn')
                .mockImplementation(() => {});
            expect(() => dismissNotice('z')).not.toThrow();
            expect(storageSpy).toHaveBeenCalledWith(
                DISMISSED_NOTICES_STORAGE_KEY,
                expect.any(String)
            );
            expect(warnSpy).toHaveBeenCalledWith(
                '[dismissNotice] storage write failed:',
                expect.any(Error)
            );
            warnSpy.mockRestore();
        });
    });
});
