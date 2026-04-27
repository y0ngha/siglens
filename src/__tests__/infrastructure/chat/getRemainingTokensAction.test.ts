import { getRemainingTokensAction } from '@/infrastructure/chat/getRemainingTokensAction';
import { createChatTokenStore, hashClientIp } from '@y0ngha/siglens-core';
import { headers } from 'next/headers';

jest.mock('next/headers', () => ({
    headers: jest.fn(),
}));

jest.mock('@y0ngha/siglens-core', () => ({
    ...jest.requireActual('@y0ngha/siglens-core'),
    createChatTokenStore: jest.fn(),
    hashClientIp: jest.fn((ip: string) => `hashed_${ip}`),
}));

const mockHeaders = headers as jest.MockedFunction<typeof headers>;
const mockCreateChatTokenStore = createChatTokenStore as jest.MockedFunction<
    typeof createChatTokenStore
>;
const mockHashClientIp = hashClientIp as jest.MockedFunction<
    typeof hashClientIp
>;
const mockGetRemainingTokens = jest.fn();

function makeHeadersMap(xForwardedFor?: string) {
    return {
        get: jest.fn((key: string) =>
            key === 'x-forwarded-for' ? (xForwardedFor ?? null) : null
        ),
    };
}

describe('getRemainingTokensAction 함수는', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockCreateChatTokenStore.mockReturnValue({
            tryConsumeToken: jest.fn(),
            getRemainingTokens: mockGetRemainingTokens,
        });
    });

    it('x-forwarded-for IP를 해시하여 core 토큰 저장소에 전달한다', async () => {
        mockHeaders.mockResolvedValue(
            makeHeadersMap('1.2.3.4') as unknown as Awaited<
                ReturnType<typeof headers>
            >
        );
        mockGetRemainingTokens.mockResolvedValue(3);

        const result = await getRemainingTokensAction();

        expect(mockHashClientIp).toHaveBeenCalledWith('1.2.3.4');
        expect(mockGetRemainingTokens).toHaveBeenCalledWith('hashed_1.2.3.4');
        expect(result).toBe(3);
    });

    it('x-forwarded-for에 여러 IP가 있으면 첫 번째 IP만 사용한다', async () => {
        mockHeaders.mockResolvedValue(
            makeHeadersMap('1.2.3.4, 5.6.7.8') as unknown as Awaited<
                ReturnType<typeof headers>
            >
        );
        mockGetRemainingTokens.mockResolvedValue(4);

        const result = await getRemainingTokensAction();

        expect(mockHashClientIp).toHaveBeenCalledWith('1.2.3.4');
        expect(result).toBe(4);
    });

    it('x-forwarded-for 헤더가 없으면 unknown IP로 처리한다', async () => {
        mockHeaders.mockResolvedValue(
            makeHeadersMap() as unknown as Awaited<ReturnType<typeof headers>>
        );
        mockGetRemainingTokens.mockResolvedValue(5);

        const result = await getRemainingTokensAction();

        expect(mockHashClientIp).toHaveBeenCalledWith('unknown');
        expect(result).toBe(5);
    });

    it('오류 발생 시 null을 반환한다', async () => {
        mockHeaders.mockRejectedValue(new Error('headers unavailable'));

        const result = await getRemainingTokensAction();

        expect(result).toBeNull();
    });
});
