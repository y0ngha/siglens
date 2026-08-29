import { afterEach, beforeEach } from 'vitest';

const ORIGINAL = process.env.DB_CONTENT_LOCALE;

afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.DB_CONTENT_LOCALE;
    else process.env.DB_CONTENT_LOCALE = ORIGINAL;
    vi.resetModules();
});

/**
 * 스위치는 **기본 꺼짐**이어야 한다. 켜져 있는데 마이그레이션이 안 된 배포는
 * 읽기 경로가 통째로 죽는다 — 기본값이 안전한 쪽이어야 한다.
 */
describe('isContentLocaleEnabled', () => {
    beforeEach(() => {
        vi.resetModules();
    });

    it('환경변수가 없으면 꺼져 있다', async () => {
        delete process.env.DB_CONTENT_LOCALE;
        const { isContentLocaleEnabled } =
            await import('@/shared/db/contentTranslationClient');
        expect(isContentLocaleEnabled()).toBe(false);
    });

    it.each(['0', 'true', 'yes', ''])(
        '%s는 켜진 것으로 보지 않는다',
        async value => {
            process.env.DB_CONTENT_LOCALE = value;
            const { isContentLocaleEnabled } =
                await import('@/shared/db/contentTranslationClient');
            expect(isContentLocaleEnabled()).toBe(false);
        }
    );

    it("'1'일 때만 켜진다", async () => {
        process.env.DB_CONTENT_LOCALE = '1';
        const { isContentLocaleEnabled } =
            await import('@/shared/db/contentTranslationClient');
        expect(isContentLocaleEnabled()).toBe(true);
    });

    /**
     * 꺼져 있으면 DB 클라이언트를 **만들지도 않는다** — `getDatabaseClient()`가
     * `DATABASE_URL` 없이 던지므로, 잘못 부르면 공지·뉴스 읽기가 전부 죽는다.
     */
    it('꺼져 있으면 Null 구현을 돌려준다', async () => {
        delete process.env.DB_CONTENT_LOCALE;
        const { getContentTranslationRepository } =
            await import('@/shared/db/contentTranslationClient');
        const repo = getContentTranslationRepository();
        const result = await repo.findForEntity('news', ['a'], 'ja');
        expect(result.byLocale('a', 'title')).toEqual({});
    });
});
