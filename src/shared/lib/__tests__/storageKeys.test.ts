import { LOCAL_STORAGE_ANALYSIS_MODEL_KEY } from '@/shared/lib/storageKeys';

describe('LOCAL_STORAGE_ANALYSIS_MODEL_KEY', () => {
    it('is the expected key', () => {
        expect(LOCAL_STORAGE_ANALYSIS_MODEL_KEY).toBe(
            'siglens:selected-analysis-model'
        );
    });
});
