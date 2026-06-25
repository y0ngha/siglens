/**
 * getClientIp — x-forwarded-for 파싱 단위 테스트.
 * next/headers와 server-only는 vitest setup에서 stub되어 있다고 가정한다.
 */

// server-only 모듈은 import 시 throw하므로 stub 처리한다.
vi.mock('server-only', () => ({}));

const { mockGet } = vi.hoisted(() => ({
    mockGet: vi.fn<(key: string) => string | null>(),
}));

vi.mock('next/headers', () => ({
    headers: () => Promise.resolve({ get: mockGet }),
}));

import { getClientIp } from '../api/getClientIp';

describe('getClientIp', () => {
    afterEach(() => {
        mockGet.mockReset();
    });

    it('x-forwarded-for 헤더의 첫 번째 IP를 반환한다', async () => {
        mockGet.mockReturnValue('1.2.3.4, 5.6.7.8');
        await expect(getClientIp()).resolves.toBe('1.2.3.4');
    });

    it('단일 IP인 경우 그대로 반환한다', async () => {
        mockGet.mockReturnValue('10.0.0.1');
        await expect(getClientIp()).resolves.toBe('10.0.0.1');
    });

    it('앞뒤 공백을 제거한다', async () => {
        mockGet.mockReturnValue('  192.168.1.1  , 10.0.0.2');
        await expect(getClientIp()).resolves.toBe('192.168.1.1');
    });

    it('헤더가 없으면 "unknown"을 반환한다', async () => {
        mockGet.mockReturnValue(null);
        await expect(getClientIp()).resolves.toBe('unknown');
    });
});
