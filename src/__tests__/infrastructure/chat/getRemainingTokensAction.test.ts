import { getRemainingTokensAction } from '@/infrastructure/chat/getRemainingTokensAction';

jest.mock('next/headers', () => ({
    headers: jest.fn(),
}));

jest.mock('@/infrastructure/chat/tokenStore', () => ({
    hashIp: jest.fn((ip: string) => `hashed_${ip}`),
    getRemainingTokens: jest.fn(),
}));

import { headers } from 'next/headers';
import { hashIp, getRemainingTokens } from '@/infrastructure/chat/tokenStore';

const mockHeaders = headers as jest.MockedFunction<typeof headers>;
const mockHashIp = hashIp as jest.MockedFunction<typeof hashIp>;
const mockGetRemainingTokens = getRemainingTokens as jest.MockedFunction<
    typeof getRemainingTokens
>;

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
    });

    it('x-forwarded-for IP를 해시하여 잔여 토큰 수를 반환한다', async () => {
        mockHeaders.mockResolvedValue(
            makeHeadersMap('1.2.3.4') as unknown as Awaited<
                ReturnType<typeof headers>
            >
        );
        mockGetRemainingTokens.mockResolvedValue(3);

        const result = await getRemainingTokensAction();

        expect(mockHashIp).toHaveBeenCalledWith('1.2.3.4');
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

        expect(mockHashIp).toHaveBeenCalledWith('1.2.3.4');
        expect(result).toBe(4);
    });

    it('x-forwarded-for 헤더가 없으면 unknown IP로 처리한다', async () => {
        mockHeaders.mockResolvedValue(
            makeHeadersMap() as unknown as Awaited<ReturnType<typeof headers>>
        );
        mockGetRemainingTokens.mockResolvedValue(5);

        const result = await getRemainingTokensAction();

        expect(mockHashIp).toHaveBeenCalledWith('unknown');
        expect(result).toBe(5);
    });

    it('오류 발생 시 null을 반환한다', async () => {
        mockHeaders.mockRejectedValue(new Error('headers unavailable'));

        const result = await getRemainingTokensAction();

        expect(result).toBeNull();
    });
});
