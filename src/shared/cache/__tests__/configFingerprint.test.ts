vi.mock('server-only', () => ({}));

import { createCacheConfigFingerprint } from '@/shared/cache/configFingerprint';

describe('createCacheConfigFingerprint', () => {
    it('동일한 설정에는 동일한 fingerprint를 반환한다', () => {
        const serializedConfig = JSON.stringify(['AAPL', 'MSFT']);

        expect(createCacheConfigFingerprint(serializedConfig)).toBe(
            createCacheConfigFingerprint(serializedConfig)
        );
    });

    it('설정 순서나 값이 달라지면 fingerprint도 달라진다', () => {
        const first = createCacheConfigFingerprint(
            JSON.stringify(['AAPL', 'MSFT'])
        );
        const second = createCacheConfigFingerprint(
            JSON.stringify(['MSFT', 'AAPL'])
        );

        expect(first).not.toBe(second);
    });
});
