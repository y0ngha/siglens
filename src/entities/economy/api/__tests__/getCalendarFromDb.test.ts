vi.mock('server-only', () => ({}));

/**
 * unstable_cache mock: call-through이지만 (fn, keyParts, options) 인자를 캡처해
 * 캐시 키·revalidate·tags 계약을 단언할 수 있게 한다.
 *
 * 모듈-레벨 unstable_cache(fn, keyParts, options) 구조:
 * - keyParts: ['economy-calendar-db']
 * - anchorEt는 반환된 래퍼 함수의 인자로 전달(auto-keyed by Next.js)
 */
let capturedKeyParts: string[] = [];
let capturedOptions: Record<string, unknown> = {};
vi.mock('next/cache', () => ({
    unstable_cache:
        (
            fn: (...a: unknown[]) => unknown,
            keyParts: string[],
            options: Record<string, unknown>
        ) =>
        (...a: unknown[]) => {
            capturedKeyParts = keyParts;
            capturedOptions = options;
            return fn(...a);
        },
}));
vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: () => ({ db: {} }),
}));

// 사이드카(content_translations) 게이트. `contentLocaleKeyPart`와
// `localizeContent`가 둘 다 이 모듈의 `isContentLocaleEnabled`를 본다 —
// 하나만 mock하면 캐시 키와 실제 조회 분기가 어긋난다.
const isContentLocaleEnabledMock = vi.fn(() => false);
const findForEntity = vi.fn();
vi.mock('@/shared/db/contentTranslationClient', () => ({
    isContentLocaleEnabled: () => isContentLocaleEnabledMock(),
    getContentTranslationRepository: () => ({ findForEntity }),
}));

const listInRange = vi.fn();
vi.mock('@/entities/economy/api/economicCalendarRepository', () => ({
    DrizzleEconomicCalendarRepository: class {
        listInRange = listInRange;
    },
}));

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { getCalendarFromDb } from '@/entities/economy/api/getCalendarFromDb';
import {
    pastWindowStart,
    futureWindowEnd,
} from '@/entities/economy/lib/calendarWindow';
import { ECONOMY_CALENDAR_REVALIDATE_SECONDS } from '@/entities/economy/lib/economyCalendarConstants';

describe('getCalendarFromDb', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        capturedKeyParts = [];
        capturedOptions = {};
        listInRange.mockResolvedValue([]);
        isContentLocaleEnabledMock.mockReturnValue(false);
        findForEntity.mockReset();
    });

    it('passes the correct key array to unstable_cache', async () => {
        await getCalendarFromDb('2026-06-20');
        expect(capturedKeyParts).toEqual(['economy-calendar-db', 'US']);
    });

    it('passes the correct revalidate and tags to unstable_cache', async () => {
        await getCalendarFromDb('2026-06-20');
        expect(capturedOptions).toMatchObject({
            revalidate: ECONOMY_CALENDAR_REVALIDATE_SECONDS,
            tags: ['economy:calendar:us'],
        });
    });

    it('reads the past-window..future-window range around the anchor', async () => {
        await getCalendarFromDb('2026-06-20');
        expect(listInRange).toHaveBeenCalledWith(
            pastWindowStart('2026-06-20'),
            futureWindowEnd('2026-06-20'),
            'US'
        );
    });

    it('returns the rows the repository produced', async () => {
        const event = {
            date: '2026-06-19 08:30:00',
            event: 'X',
            impact: 'High' as const,
            actual: 1,
            estimate: 1,
            previous: 1,
            unit: '%',
        };
        listInRange.mockResolvedValue([event]);
        const events = await getCalendarFromDb('2026-06-20');
        expect(events).toEqual([event]);
    });

    it('degrades to [] on DB failure (graceful, not throw)', async () => {
        listInRange.mockRejectedValue(new Error('neon down'));
        const events = await getCalendarFromDb('2026-06-20');
        expect(events).toEqual([]);
    });

    /**
     * 리더는 국가별 `unstable_cache` 래퍼를 Map에 메모한다. 그 Map이 국가를 키로
     * 쓰지 않으면 (a) `/economy/kr`이 미국 ISR 엔트리를 그대로 서빙하거나
     * (b) KR 인제스션의 `revalidateTag('economy:calendar:kr')`이 아무것도 못 맞춰
     * `/economy/kr`이 24시간 얼어붙는다. 메모 때문에 순서 의존이라 한 국가만
     * 테스트해서는 절대 드러나지 않는다.
     */
    it('KR은 자기 캐시 키·태그·국가 필터를 쓴다', async () => {
        await getCalendarFromDb('2026-06-20', 'KR');

        expect(capturedKeyParts).toEqual(['economy-calendar-db', 'KR']);
        expect(capturedOptions).toMatchObject({
            tags: ['economy:calendar:kr'],
        });
        expect(listInRange).toHaveBeenCalledWith(
            expect.any(String),
            expect.any(String),
            'KR'
        );
    });

    /**
     * 기본 로케일(ko)은 `localizeCalendarRows`가 사이드카 조회 없이 바로
     * 원본 행을 돌려준다 — 한국어는 원문 자체가 값이라 조회할 게 없다.
     */
    it('ko 로케일은 사이드카를 조회하지 않고 원본 행을 그대로 반환한다', async () => {
        const event = {
            date: '2026-06-19 08:30:00',
            event: 'CPI',
            impact: 'High' as const,
            actual: 1,
            estimate: 1,
            previous: 1,
            unit: '%',
            summaryKo: '한국어 요약',
        };
        listInRange.mockResolvedValue([event]);

        const events = await getCalendarFromDb('2026-06-20', 'US', 'ko');

        expect(events).toEqual([event]);
        expect(findForEntity).not.toHaveBeenCalled();
    });

    /**
     * 비-ko 로케일은 사이드카를 조회하고, 사이드카에 그 로케일 행이 있으면
     * (`fromSidecar: true`) `summaryLocalized`/`interpretationLocalized`를 채운다.
     */
    it('비-ko 로케일 + 사이드카 히트 시 summaryLocalized/interpretationLocalized를 채운다', async () => {
        const event = {
            date: '2026-06-19 08:30:00',
            event: 'CPI',
            impact: 'High' as const,
            actual: 1,
            estimate: 1,
            previous: 1,
            unit: '%',
            summaryKo: '한국어 요약',
            interpretationKo: '한국어 해석',
        };
        listInRange.mockResolvedValue([event]);
        // 스위치를 켜야 `calendarReaderFor`의 memo key에 로케일이 섞여, 앞선
        // 테스트에서 만들어진 ko 전용 리더(캐시 키가 국가만 갖는 리더)와
        // 충돌하지 않는다 — `contentLocaleKeyPart` JSDoc 참고.
        isContentLocaleEnabledMock.mockReturnValue(true);
        findForEntity.mockResolvedValue({
            resolve: (
                _entityId: string,
                field: string
            ): { value: string; fromSidecar: boolean } => ({
                value:
                    field === 'summary'
                        ? 'English summary'
                        : 'English interpretation',
                fromSidecar: true,
            }),
        });

        const events = await getCalendarFromDb('2026-06-20', 'US', 'en');

        expect(events[0].summaryLocalized).toBe('English summary');
        expect(events[0].interpretationLocalized).toBe(
            'English interpretation'
        );
    });

    /**
     * 사이드카에 그 로케일 행이 없으면(`fromSidecar: false`) 폴백이므로
     * `*Localized`를 비워 둔다 — 렌더가 한국어 원문(`summaryKo`)을 쓰게 한다.
     * 폴백 값을 채우면 ISR 블롭이 로케일 의존이 되어 캐시 오염이 생긴다.
     */
    it('비-ko 로케일 + 사이드카 미스 시 *Localized를 채우지 않는다(한국어 원문 폴백)', async () => {
        const event = {
            date: '2026-06-19 08:30:00',
            event: 'CPI',
            impact: 'High' as const,
            actual: 1,
            estimate: 1,
            previous: 1,
            unit: '%',
            summaryKo: '한국어 요약',
        };
        listInRange.mockResolvedValue([event]);
        isContentLocaleEnabledMock.mockReturnValue(true);
        findForEntity.mockResolvedValue({
            resolve: () => ({ value: '한국어 요약', fromSidecar: false }),
        });

        const events = await getCalendarFromDb('2026-06-20', 'US', 'en');

        expect(events[0].summaryLocalized).toBeUndefined();
        expect(events[0].interpretationLocalized).toBeUndefined();
    });

    /**
     * 사이드카 스위치가 켜져 있으면 캐시 키가 로케일별로 갈려야 한다 —
     * 아니면 먼저 생성된 로케일의 값이 나머지 로케일에 굳는다.
     */
    it('사이드카 스위치가 켜져 있으면 비-ko 캐시 키에 로케일 조각이 붙는다', async () => {
        isContentLocaleEnabledMock.mockReturnValue(true);
        findForEntity.mockResolvedValue({
            resolve: () => ({ value: 'x', fromSidecar: false }),
        });

        await getCalendarFromDb('2026-06-20', 'US', 'ja');

        expect(capturedKeyParts).toEqual(['economy-calendar-db', 'US', 'ja']);
    });

    it('KR 조회 뒤에도 US는 여전히 US 키를 쓴다 (래퍼 메모가 뭉개지지 않는다)', async () => {
        await getCalendarFromDb('2026-06-20', 'KR');
        await getCalendarFromDb('2026-06-20', 'US');

        expect(capturedKeyParts).toEqual(['economy-calendar-db', 'US']);
        expect(capturedOptions).toMatchObject({
            tags: ['economy:calendar:us'],
        });
    });
});
