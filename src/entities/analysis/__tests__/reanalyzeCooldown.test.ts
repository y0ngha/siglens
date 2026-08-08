import type { MockedFunction } from 'vitest';
import {
    getReanalyzeCooldownMs,
    tryAcquireReanalyzeCooldown,
} from '../lib/reanalyzeCooldown';

/**
 * Task 5: `releaseReanalyzeCooldown`이 공개 server-action 표면에 없음을 보장한다.
 *
 * `reanalyzeCooldown.ts` 헤더 주석에 의도가 명시돼 있다:
 * "releaseReanalyzeCooldown은 의도적으로 이 파일에 없다". 그러나 주석만으로는
 * 미래의 실수로 함수가 추가되는 것을 막을 수 없다. 이 테스트가 정적 gate 역할을 한다.
 *
 * 이 함수가 `'use server'` 파일에 노출되면 클라이언트가 쿨다운을 임의로 해제해
 * 재분석 쿨다운 정책 전체를 우회할 수 있다.
 */
import * as reanalyzeCooldownModule from '../lib/reanalyzeCooldown';

it('releaseReanalyzeCooldown은 공개 server-action 표면에 노출되지 않는다', () => {
    expect(Object.keys(reanalyzeCooldownModule)).not.toContain(
        'releaseReanalyzeCooldown'
    );
});
import {
    getReanalyzeCooldownMs as coreGetMs,
    tryAcquireReanalyzeCooldown as coreTryAcquire,
} from '@y0ngha/siglens-core';

vi.mock('@y0ngha/siglens-core', async () => ({
    ...(await vi.importActual('@y0ngha/siglens-core')),
    tryAcquireReanalyzeCooldown: vi.fn(),
    getReanalyzeCooldownMs: vi.fn(),
}));

const mockTryAcquire = coreTryAcquire as MockedFunction<typeof coreTryAcquire>;
const mockGetMs = coreGetMs as MockedFunction<typeof coreGetMs>;

describe('reanalyzeCooldown wrapper는', () => {
    beforeEach(() => {
        mockTryAcquire.mockReset();
        mockGetMs.mockReset();
    });

    it('tryAcquireReanalyzeCooldown은 인자를 그대로 위임한다', async () => {
        mockTryAcquire.mockResolvedValueOnce({ ok: true });

        const result = await tryAcquireReanalyzeCooldown('AAPL', '1Day');

        expect(mockTryAcquire).toHaveBeenCalledWith('AAPL', '1Day');
        expect(result).toEqual({ ok: true });
    });

    it('tryAcquireReanalyzeCooldown은 core가 예외를 던지면 { ok: true }를 반환한다', async () => {
        mockTryAcquire.mockRejectedValueOnce(
            new Error('Redis connection failed')
        );

        const result = await tryAcquireReanalyzeCooldown('AAPL', '1Day');

        expect(result).toEqual({ ok: true });
    });

    it('getReanalyzeCooldownMs는 인자를 위임하고 ms 값을 반환한다', async () => {
        mockGetMs.mockResolvedValueOnce(120_000);

        const result = await getReanalyzeCooldownMs('AAPL', '1Day');

        expect(mockGetMs).toHaveBeenCalledWith('AAPL', '1Day');
        expect(result).toBe(120_000);
    });

    it('getReanalyzeCooldownMs는 core가 예외를 던지면 0을 반환한다', async () => {
        mockGetMs.mockRejectedValueOnce(new Error('Redis connection failed'));

        const result = await getReanalyzeCooldownMs('AAPL', '1Day');

        expect(result).toBe(0);
    });
});
