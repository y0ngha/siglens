// @vitest-environment node
const { mockGetLocale } = vi.hoisted(() => ({ mockGetLocale: vi.fn() }));

vi.mock('next-intl/server', () => ({ getLocale: mockGetLocale }));
vi.mock('server-only', () => ({}));

import { resolveRequestLocale } from '../requestLocale';

describe('resolveRequestLocale', () => {
    beforeEach(() => {
        mockGetLocale.mockReset();
    });

    it('지원하는 로케일이면 그대로 반환한다', async () => {
        mockGetLocale.mockResolvedValue('ja');
        expect(await resolveRequestLocale()).toBe('ja');
    });

    it('카탈로그에 없는 값이면 기본 로케일로 좁힌다', async () => {
        mockGetLocale.mockResolvedValue('xx');
        expect(await resolveRequestLocale()).toBe('ko');
    });

    /**
     * `getLocale()`은 next-intl 미들웨어가 심는 헤더가 없는 경로(테스트·직접
     * 호출)에서 던진다 — 로케일이 부수적인 작업(메일 발송 등)까지 통째로
     * 실패시키지 않고 기본 로케일로 떨어뜨린다.
     */
    it('getLocale()이 던지면 기본 로케일로 떨어진다', async () => {
        mockGetLocale.mockRejectedValue(
            new Error('No locale was found in the request')
        );
        expect(await resolveRequestLocale()).toBe('ko');
    });
});
