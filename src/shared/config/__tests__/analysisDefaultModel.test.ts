import { DEEPSEEK_V4_1_FLASH_MODEL } from '@y0ngha/siglens-core';
import { DEFAULT_ANALYSIS_MODEL } from '@/shared/config/analysisDefaultModel';

describe('DEFAULT_ANALYSIS_MODEL', () => {
    it('core의 DeepSeek V4.1 Flash 상수와 같다', () => {
        expect(DEFAULT_ANALYSIS_MODEL).toBe(DEEPSEEK_V4_1_FLASH_MODEL);
    });
});
