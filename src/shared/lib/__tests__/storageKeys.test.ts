import {
    LOCAL_STORAGE_PROVIDER_KEY,
    LOCAL_STORAGE_ANALYSIS_MODEL_KEY,
} from '@/shared/lib/storageKeys';

describe('LOCAL_STORAGE_PROVIDER_KEY', () => {
    it('is the expected key', () => {
        expect(LOCAL_STORAGE_PROVIDER_KEY).toBe('siglens:selected-provider');
    });

    it('uses the siglens namespace prefix', () => {
        expect(LOCAL_STORAGE_PROVIDER_KEY).toMatch(/^siglens:/);
    });
});

describe('LOCAL_STORAGE_ANALYSIS_MODEL_KEY', () => {
    it('is the expected key', () => {
        expect(LOCAL_STORAGE_ANALYSIS_MODEL_KEY).toBe(
            'siglens:selected-analysis-model'
        );
    });

    it('uses the siglens namespace prefix', () => {
        expect(LOCAL_STORAGE_ANALYSIS_MODEL_KEY).toMatch(/^siglens:/);
    });
});
