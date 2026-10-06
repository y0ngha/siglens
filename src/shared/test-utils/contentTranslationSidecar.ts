import {
    ContentTranslations,
    type ContentTranslationRepository,
} from '@/shared/db/contentTranslationRepository';
import { TRANSLATION_SOURCE } from '@/shared/db/contentTranslationFields';
import type { Locale } from '@/shared/i18n/locales';

type ContentTranslationClient =
    typeof import('@/shared/db/contentTranslationClient');
type TranslationIndex = ConstructorParameters<typeof ContentTranslations>[0];

/** 사이드카에 들어 있는 번역 한 칸 — (행, 필드, 로케일) → 값. */
export interface SidecarCell {
    readonly id: string;
    readonly field: string;
    readonly locale: Locale;
    readonly value: string;
}

/**
 * 테스트가 케이스마다 바꿔 끼우는 사이드카 상태. `vi.hoisted`로 만들어 mock
 * 팩토리와 테스트 본문이 같은 객체를 본다.
 *
 * `cells`가 `null`이면 **실물** `contentTranslationClient`를 그대로 탄다(스위치
 * OFF 경로를 대역 없이 검증한다). 배열이면 그 칸만 가진 리포지터리를 돌려준다.
 */
export interface SidecarState {
    cells: readonly SidecarCell[] | null;
}

function sidecarIndex(cells: readonly SidecarCell[]): TranslationIndex {
    const index: TranslationIndex = new Map();
    for (const cell of cells) {
        const byField = index.get(cell.id) ?? new Map();
        const byLocale = byField.get(cell.field) ?? new Map();
        byLocale.set(cell.locale, {
            value: cell.value,
            source: TRANSLATION_SOURCE.ai,
        });
        byField.set(cell.field, byLocale);
        index.set(cell.id, byField);
    }
    return index;
}

function sidecarRepository(
    cells: readonly SidecarCell[]
): ContentTranslationRepository {
    return {
        findForEntity: async () => new ContentTranslations(sidecarIndex(cells)),
    };
}

/**
 * `vi.mock('@/shared/db/contentTranslationClient', ...)` 팩토리가 돌려줄 모듈.
 * 팩토리 안에서 동적 import로 불러 쓴다 — 팩토리는 파일 상단 import보다 먼저
 * 끌어올려지므로 정적 import를 쓸 수 없다.
 *
 * 예전엔 이 대역이 케이스마다 `vi.resetModules()` + `vi.doMock` + 재import였고,
 * 그때마다 DB 스키마·drizzle 그래프가 새로 평가돼 병렬 부하에서 기본 5초를
 * 넘겼다(2026-10-06). 스위치는 호출 시점에 env를 읽으므로 파일 단위 mock 하나가
 * 상태를 읽게 하면 모듈은 한 번만 적재된다.
 */
export function sidecarAwareClient(
    real: ContentTranslationClient,
    state: SidecarState
): ContentTranslationClient {
    return {
        ...real,
        isContentLocaleEnabled: () =>
            state.cells === null ? real.isContentLocaleEnabled() : true,
        getContentTranslationRepository: () =>
            state.cells === null
                ? real.getContentTranslationRepository()
                : sidecarRepository(state.cells),
    };
}
