import { isPublicApiEnabled } from '@/shared/api/publicApiEnabled';

describe('isPublicApiEnabled', () => {
    it('플래그가 없으면 꺼짐(기본값)', () => {
        vi.stubEnv('PUBLIC_API_ENABLED', undefined);
        expect(isPublicApiEnabled()).toBe(false);
    });

    it.each(['', '   ', 'false', '0', 'off', 'no', 'enabled', 'TRUE1'])(
        '%j는 꺼짐',
        raw => {
            vi.stubEnv('PUBLIC_API_ENABLED', raw);
            expect(isPublicApiEnabled()).toBe(false);
        }
    );

    it.each(['true', 'TRUE', ' True ', '1', 'on', 'YES'])('%j는 켜짐', raw => {
        vi.stubEnv('PUBLIC_API_ENABLED', raw);
        expect(isPublicApiEnabled()).toBe(true);
    });
});
