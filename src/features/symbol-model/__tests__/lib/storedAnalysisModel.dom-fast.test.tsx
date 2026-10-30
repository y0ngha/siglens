import type { ModelId } from '@y0ngha/siglens-core';
import {
    readStoredModel,
    writeStoredModel,
} from '@/features/symbol-model/lib/storedAnalysisModel';
import { LOCAL_STORAGE_ANALYSIS_MODEL_KEY } from '@/shared/lib/storageKeys';

const MODEL = 'gemini-3.6-flash' as ModelId;

describe('storedAnalysisModel', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('siglens:selected-analysis-model 키에 쓴다(이미 저장된 선택을 읽으려면 바뀌면 안 된다)', () => {
        writeStoredModel(MODEL);

        expect(localStorage.getItem('siglens:selected-analysis-model')).toBe(
            MODEL
        );
    });

    it('저장값이 없으면 null', () => {
        expect(readStoredModel()).toBeNull();
    });

    it('쓴 모델을 같은 키에서 다시 읽는다', () => {
        writeStoredModel(MODEL);

        expect(localStorage.getItem(LOCAL_STORAGE_ANALYSIS_MODEL_KEY)).toBe(
            MODEL
        );
        expect(readStoredModel()).toBe(MODEL);
    });

    it('읽기가 막히면(SecurityError) 던지지 않고 null', () => {
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new DOMException('blocked', 'SecurityError');
        });

        expect(readStoredModel()).toBeNull();
    });

    it('쓰기가 막혀도(SecurityError) 던지지 않는다', () => {
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new DOMException('blocked', 'SecurityError');
        });

        expect(() => writeStoredModel(MODEL)).not.toThrow();
    });
});
