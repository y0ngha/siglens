// DrizzleTermsRepository, getActiveTerms는 barrel에서 제외한다 — api.ts가
// drizzle/schema import, `server-only` 체인(getDatabaseClient)을 물고 있다.
// 서버 소비자는 `@/entities/terms/api`에서 직접 import한다.
export {
    type TermsRecord,
    type TermsSeedInput,
    type TermsRepository,
} from './api';
