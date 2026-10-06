// vi.mock → imports 순서 (MISTAKES.md Tests §17)
/**
 * `getDatabaseClient`를 파일 전체에서 대역한다. 예전엔 케이스마다
 * `vi.resetModules()` 뒤 이 모듈을 다시 import했는데, 그때마다 DB 스키마·drizzle
 * 그래프가 새로 평가돼 병렬 부하에서 기본 5초를 넘겼다. 스위치는 **호출 시점**에
 * `process.env`를 읽으므로(모듈 평가 시점이 아니다) 모듈을 새로 받을 이유가 없다.
 *
 * 대역은 호출 여부를 기록한다 — "꺼져 있으면 DB 클라이언트를 만들지도 않는다"를
 * 예전처럼 `DATABASE_URL` 없는 실물이 던지는지에 기대지 않고 직접 단언한다.
 */
const { getDatabaseClientMock } = vi.hoisted(() => ({
    getDatabaseClientMock: vi.fn(() => ({ db: {} })),
}));
vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: getDatabaseClientMock,
}));

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    getContentTranslationRepository,
    isContentLocaleEnabled,
} from '@/shared/db/contentTranslationClient';
import {
    DrizzleContentTranslationRepository,
    NullContentTranslationRepository,
} from '@/shared/db/contentTranslationRepository';

const ORIGINAL = process.env.DB_CONTENT_LOCALE;

afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.DB_CONTENT_LOCALE;
    else process.env.DB_CONTENT_LOCALE = ORIGINAL;
    getDatabaseClientMock.mockClear();
});

/**
 * 스위치는 **기본 꺼짐**이어야 한다. 켜져 있는데 마이그레이션이 안 된 배포는
 * 읽기 경로가 통째로 죽는다 — 기본값이 안전한 쪽이어야 한다.
 */
describe('isContentLocaleEnabled', () => {
    it('환경변수가 없으면 꺼져 있다', () => {
        delete process.env.DB_CONTENT_LOCALE;
        expect(isContentLocaleEnabled()).toBe(false);
    });

    it.each(['0', 'true', 'yes', ''])('%s는 켜진 것으로 보지 않는다', value => {
        process.env.DB_CONTENT_LOCALE = value;
        expect(isContentLocaleEnabled()).toBe(false);
    });

    it("'1'일 때만 켜진다", () => {
        process.env.DB_CONTENT_LOCALE = '1';
        expect(isContentLocaleEnabled()).toBe(true);
    });

    /**
     * 꺼져 있으면 DB 클라이언트를 **만들지도 않는다** — `getDatabaseClient()`가
     * `DATABASE_URL` 없이 던지므로, 잘못 부르면 공지·뉴스 읽기가 전부 죽는다.
     */
    it('꺼져 있으면 Null 구현을 돌려준다', async () => {
        delete process.env.DB_CONTENT_LOCALE;
        const repo = getContentTranslationRepository();
        expect(repo).toBeInstanceOf(NullContentTranslationRepository);
        expect(getDatabaseClientMock).not.toHaveBeenCalled();
        const result = await repo.findForEntity('news', ['a'], 'ja');
        expect(result.byLocale('a', 'title')).toEqual({});
    });

    /**
     * 켜져 있으면 실제 Drizzle 구현으로 라우팅해야 한다 — 그래야 사이드카를
     * 실제로 조회한다. `getDatabaseClient`를 fake db로 대역해 Neon 연결
     * 없이 "Drizzle 구현이 선택됐다"만 확인한다(실제 쿼리 동작은
     * `DrizzleContentTranslationRepository`의 자체 단위 테스트가 검증).
     */
    it("'1'이면 DrizzleContentTranslationRepository로 라우팅한다", () => {
        process.env.DB_CONTENT_LOCALE = '1';

        const repo = getContentTranslationRepository();

        expect(repo).toBeInstanceOf(DrizzleContentTranslationRepository);
        expect(getDatabaseClientMock).toHaveBeenCalledTimes(1);
    });
});
