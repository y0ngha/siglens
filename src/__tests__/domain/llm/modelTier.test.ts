import { isFreeChatModel } from '@/domain/llm/modelTier';
import {
    GEMINI_2_5_FLASH_LITE_MODEL,
    GEMINI_2_5_FLASH_MODEL,
    GEMINI_2_5_PRO_MODEL,
} from '@y0ngha/siglens-core';

describe('isFreeChatModel', () => {
    it('gemini-2.5-flash는 Free 모델이다', () => {
        expect(isFreeChatModel(GEMINI_2_5_FLASH_MODEL)).toBe(true);
    });

    it('gemini-2.5-flash-lite는 Free 모델이다', () => {
        expect(isFreeChatModel(GEMINI_2_5_FLASH_LITE_MODEL)).toBe(true);
    });

    it('claude-haiku-4-5는 Free 모델이다', () => {
        expect(isFreeChatModel('claude-haiku-4-5')).toBe(true);
    });

    it('gpt-5-mini는 Free 모델이다', () => {
        expect(isFreeChatModel('gpt-5-mini')).toBe(true);
    });

    it('gemini-2.5-pro는 Premium 모델이다', () => {
        expect(isFreeChatModel(GEMINI_2_5_PRO_MODEL)).toBe(false);
    });

    it('claude-opus-4-7는 Premium 모델이다', () => {
        expect(isFreeChatModel('claude-opus-4-7')).toBe(false);
    });
});
