import type { ChatModel } from '@/domain/types';

export const GEMINI_2_5_FLASH_MODEL = 'gemini-2.5-flash' as const;
export const GEMINI_2_5_FLASH_LITE_MODEL = 'gemini-2.5-flash-lite' as const;

export const VALID_CHAT_MODELS = [
    GEMINI_2_5_FLASH_MODEL,
    GEMINI_2_5_FLASH_LITE_MODEL,
] as const satisfies readonly ChatModel[];
