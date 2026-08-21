import 'server-only';

import { getDatabaseClient } from './client';
import {
    DrizzleContentTranslationRepository,
    NullContentTranslationRepository,
    type ContentTranslationRepository,
} from './contentTranslationRepository';

/**
 * **로케일 마이그레이션이 적용됐는지**를 나타내는 배포 스위치.
 *
 * 한 마이그레이션이 세 가지를 함께 만든다: `content_translations` 테이블,
 * `shared_analyses.locale`, `seo_analysis_snapshots.locale`. 그래서 스위치도
 * 하나다 — 셋을 따로 켜면 켠 것과 안 켠 것의 조합이 8가지가 되고, 그중 어느
 * 하나가 잘못된 배포에서 무슨 일이 나는지 아무도 모른다.
 *
 * **이 스위치가 가리는 것은 읽기뿐이다.** 쓰기 경로는 스위치와 무관하게
 * `locale` 컬럼을 넣는다 — Drizzle이 스키마에 있는 컬럼을 values에서 빼도
 * `default`로 항상 INSERT에 넣기 때문이다(실측: `values({...}).toSQL()`).
 * 한때 이 주석은 "마이그레이션 전과 정확히 같은 SQL이 나간다"고 적혀 있었고,
 * 그 오해가 "코드 먼저" 순서를 만들었다. `upsertSql.test.ts`가 그 오해를
 * 다시 못 하도록 생성된 SQL을 직접 검사한다.
 *
 * **순서**: (1) `yarn db:migrate --until 0029_content_locale` → (2) 코드 배포 →
 * (3) `yarn db:migrate`(0030) → (4) 백필 → (5) 번역 → (6) 점검 →
 * (7) `DB_CONTENT_LOCALE=1` 후 재배포. 스키마가 **먼저**다 — 자세한 근거는
 * `DEPLOY_RUNBOOK.md`. 4·5번을 건너뛰고 7번을 켜도 화면은 멀쩡하다(사이드카가
 * 비어 폴백) — 무동작이지 오작동이 아니다.
 *
 * `NEXT_PUBLIC_`이 아니다 — 서버 경로에서만 쓰이고 클라이언트가 알 필요가 없다.
 */
export function isContentLocaleEnabled(): boolean {
    return process.env.DB_CONTENT_LOCALE === '1';
}

/**
 * 읽기 경로가 쓸 번역 리포지터리.
 *
 * 스위치 분기를 여기 한 곳에 가둔다 — 리포지터리마다 `if (flag)`를 두면
 * 켜는 것을 하나 빠뜨렸을 때 그 화면만 조용히 한국어로 남는다.
 */
export function getContentTranslationRepository(): ContentTranslationRepository {
    if (!isContentLocaleEnabled()) {
        return new NullContentTranslationRepository();
    }
    const { db } = getDatabaseClient();
    return new DrizzleContentTranslationRepository(db);
}
