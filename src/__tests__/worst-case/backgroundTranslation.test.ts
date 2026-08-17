vi.mock('@/entities/llm-provider', () => ({
    callDeepseekChat: vi.fn(),
    parseJsonResponse: vi.fn(),
}));

vi.mock('@/entities/ticker/lib/config', () => ({
    tryReadTranslatorConfig: vi.fn(),
}));

import {
    translateCompanyNames,
    translateCompanyDescription,
} from '@/entities/ticker/lib/koreanTranslator';
import { callDeepseekChat, parseJsonResponse } from '@/entities/llm-provider';
import { tryReadTranslatorConfig } from '@/entities/ticker/lib/config';

const mockCallDeepseek = callDeepseekChat as ReturnType<typeof vi.fn>;
const mockParseJson = parseJsonResponse as ReturnType<typeof vi.fn>;
const mockReadConfig = tryReadTranslatorConfig as ReturnType<typeof vi.fn>;

const CONFIG = {
    apiKey: 'test-key',
    model: 'deepseek-v4-flash',
};

describe('Background translation failure handling', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('translateCompanyNames', () => {
        it('returns empty object when DeepSeek fails', async () => {
            mockReadConfig.mockReturnValue(CONFIG);
            mockCallDeepseek.mockRejectedValue(new Error('DeepSeek 500'));

            const result = await translateCompanyNames([
                { symbol: 'AAPL', name: 'Apple Inc.' },
            ]);

            expect(result).toEqual({});
        });

        it('returns empty object when config is unavailable', async () => {
            mockReadConfig.mockReturnValue(null);

            const result = await translateCompanyNames([
                { symbol: 'AAPL', name: 'Apple Inc.' },
            ]);

            expect(result).toEqual({});
        });

        it('returns empty object for empty entries', async () => {
            const result = await translateCompanyNames([]);

            expect(result).toEqual({});
        });

        it('returns translations when DeepSeek succeeds', async () => {
            mockReadConfig.mockReturnValue(CONFIG);
            mockCallDeepseek.mockResolvedValue('{"AAPL":"애플"}');
            mockParseJson.mockReturnValue({ AAPL: '애플' });

            const result = await translateCompanyNames([
                { symbol: 'AAPL', name: 'Apple Inc.' },
            ]);

            expect(result).toEqual({ AAPL: '애플' });
        });

        it('returns empty object when parseJsonResponse returns non-string-record', async () => {
            mockReadConfig.mockReturnValue(CONFIG);
            mockCallDeepseek.mockResolvedValue('[1,2,3]');
            mockParseJson.mockReturnValue([1, 2, 3]);

            const result = await translateCompanyNames([
                { symbol: 'AAPL', name: 'Apple Inc.' },
            ]);

            expect(result).toEqual({});
        });
    });

    describe('translateCompanyDescription', () => {
        it('returns null when DeepSeek fails', async () => {
            mockReadConfig.mockReturnValue(CONFIG);
            mockCallDeepseek.mockRejectedValue(new Error('API error'));

            const result = await translateCompanyDescription(
                'Apple makes iPhones'
            );

            expect(result).toBeNull();
        });

        it('returns null when config is unavailable', async () => {
            mockReadConfig.mockReturnValue(null);

            const result = await translateCompanyDescription(
                'Apple makes iPhones'
            );

            expect(result).toBeNull();
        });

        it('returns translated text on success', async () => {
            mockReadConfig.mockReturnValue(CONFIG);
            mockCallDeepseek.mockResolvedValue('애플은 아이폰을 만듭니다');

            const result = await translateCompanyDescription(
                'Apple makes iPhones'
            );

            expect(result).toBe('애플은 아이폰을 만듭니다');
        });

        it('returns null for empty response', async () => {
            mockReadConfig.mockReturnValue(CONFIG);
            mockCallDeepseek.mockResolvedValue('   ');

            const result = await translateCompanyDescription(
                'Apple makes iPhones'
            );

            expect(result).toBeNull();
        });
    });
});
