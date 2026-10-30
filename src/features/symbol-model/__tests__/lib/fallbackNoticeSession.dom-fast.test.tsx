import { claimFallbackNotice } from '@/features/symbol-model/lib/fallbackNoticeSession';
import { SESSION_STORAGE_MODEL_FALLBACK_NOTICE_KEY } from '@/shared/lib/storageKeys';

describe('claimFallbackNotice', () => {
    beforeEach(() => {
        sessionStorage.clear();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('이번 세션 첫 호출은 true', () => {
        expect(claimFallbackNotice()).toBe(true);
    });

    it('siglens:model-fallback-notice:v1 세션 키에 기록한다(바뀌면 같은 탭에서 안내가 다시 뜬다)', () => {
        claimFallbackNotice();

        expect(sessionStorage.getItem('siglens:model-fallback-notice:v1')).toBe(
            '1'
        );
    });

    it('세션 키에 이미 기록이 있으면 false', () => {
        sessionStorage.setItem(SESSION_STORAGE_MODEL_FALLBACK_NOTICE_KEY, '1');

        expect(claimFallbackNotice()).toBe(false);
    });

    it('저장소가 막히면 띄우는 쪽(true)으로 본다', () => {
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new DOMException('blocked', 'SecurityError');
        });

        expect(claimFallbackNotice()).toBe(true);
    });
});
