vi.mock('server-only', () => ({}));

import { createCacheConfigFingerprint } from '@/shared/cache/configFingerprint';

describe('createCacheConfigFingerprint', () => {
    it('알려진 입력에 대해 SHA-256 앞 12자리 hex를 반환한다', () => {
        // 결정론적 핀(같은 입력으로 같은 함수를 두 번 호출해 비교하면 어떤
        // 결정론적 함수든 항상 통과하므로 무의미 — §13). 고정값으로 박아
        // 해시 알고리즘/slice 길이 회귀를 잡는다.
        expect(
            createCacheConfigFingerprint(JSON.stringify(['AAPL', 'MSFT']))
        ).toBe('a1c55462c19f');
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
