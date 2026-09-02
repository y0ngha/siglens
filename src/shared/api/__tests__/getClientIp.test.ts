/**
 * getClientIp — cf-connecting-ip 우선 + x-forwarded-for 폴백 단위 테스트.
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

import { getClientIp } from '@/shared/api/getClientIp';

describe('getClientIp', () => {
    afterEach(() => {
        mockGet.mockReset();
    });

    it('x-forwarded-for 헤더의 첫 번째 IP를 반환한다', async () => {
        mockGet.mockImplementation((key: string) =>
            key === 'x-forwarded-for' ? '1.2.3.4, 5.6.7.8' : null
        );
        await expect(getClientIp()).resolves.toBe('1.2.3.4');
    });

    it('단일 IP인 경우 그대로 반환한다', async () => {
        mockGet.mockImplementation((key: string) =>
            key === 'x-forwarded-for' ? '10.0.0.1' : null
        );
        await expect(getClientIp()).resolves.toBe('10.0.0.1');
    });

    it('앞뒤 공백을 제거한다', async () => {
        mockGet.mockImplementation((key: string) =>
            key === 'x-forwarded-for' ? '  192.168.1.1  , 10.0.0.2' : null
        );
        await expect(getClientIp()).resolves.toBe('192.168.1.1');
    });

    it('헤더가 없으면 "unknown"을 반환한다', async () => {
        mockGet.mockReturnValue(null);
        await expect(getClientIp()).resolves.toBe('unknown');
    });

    it('cf-connecting-ip가 있으면 그것을 쓴다', async () => {
        mockGet.mockImplementation((key: string) =>
            key === 'cf-connecting-ip' ? '203.0.113.10' : null
        );
        await expect(getClientIp()).resolves.toBe('203.0.113.10');
    });

    it('x-forwarded-for가 위조돼도 cf-connecting-ip가 이긴다', async () => {
        // Cloudflare·ALB는 x-forwarded-for를 덮어쓰지 않고 덧붙인다. 첫 값은
        // 호출자가 심은 것일 수 있으므로 신뢰하지 않는다.
        mockGet.mockImplementation((key: string) => {
            if (key === 'cf-connecting-ip') return '203.0.113.10';
            if (key === 'x-forwarded-for') return '1.2.3.4, 203.0.113.10';
            return null;
        });
        await expect(getClientIp()).resolves.toBe('203.0.113.10');
    });

    it('cf-connecting-ip가 비어 있으면 x-forwarded-for로 폴백한다', async () => {
        mockGet.mockImplementation((key: string) =>
            key === 'x-forwarded-for' ? '198.51.100.7, 10.0.0.1' : null
        );
        await expect(getClientIp()).resolves.toBe('198.51.100.7');
    });

    it('cf-connecting-ip가 공백뿐이면 폴백한다', async () => {
        mockGet.mockImplementation((key: string) => {
            if (key === 'cf-connecting-ip') return '   ';
            if (key === 'x-forwarded-for') return '198.51.100.7';
            return null;
        });
        await expect(getClientIp()).resolves.toBe('198.51.100.7');
    });
});
