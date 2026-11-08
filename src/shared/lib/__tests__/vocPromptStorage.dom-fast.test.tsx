import {
    isVocPromptPending,
    markVocPrompted,
} from '@/shared/lib/vocPromptStorage';
import { LOCAL_STORAGE_VOC_PROMPTED_KEY } from '@/shared/lib/storageKeys';

describe('vocPromptStorage', () => {
    afterEach(() => {
        localStorage.clear();
        vi.restoreAllMocks();
    });

    it('기록이 없으면 대기 중이다', () => {
        expect(isVocPromptPending()).toBe(true);
    });

    it('띄웠다고 표시하면 더는 대기가 아니다', () => {
        markVocPrompted();

        expect(localStorage.getItem(LOCAL_STORAGE_VOC_PROMPTED_KEY)).toBe('1');
        expect(isVocPromptPending()).toBe(false);
    });

    it('저장소 읽기가 막혀 있으면 대기가 아니다(매 방문 뜨지 않도록)', () => {
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('blocked');
        });

        expect(isVocPromptPending()).toBe(false);
    });

    it('저장소 쓰기가 막혀 있어도 던지지 않는다', () => {
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('blocked');
        });

        expect(() => markVocPrompted()).not.toThrow();
    });
});
