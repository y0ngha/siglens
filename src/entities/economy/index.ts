/**
 * entities/economy public barrel.
 *
 * 외부 layer(`app/`, `widgets/`)는 이 barrel을 통해서만 entity의 lib/ 헬퍼를 import한다
 * (CLAUDE.md "production 코드는 슬라이스 barrel(index.ts)만 import"). server-only 의존성을
 * 가진 api/ 모듈(`economySnapshotStaticCache`, `macroBriefingStaticCache`, `economySnapshotCache`)과
 * Server Action(`actions/*`)은 client 번들 누출 방지를 위해 barrel 제외 — 호출부가 deep
 * path로 직접 import한다(entities/CLAUDE.md "barrel 제외 대상" 규칙).
 *
 * `indicatorNameKo` 모듈은 순수(React/server-only/DB 비의존)이므로 client 소비자
 * (`useIndicatorTranslationTrigger`)에서 barrel을 통해 import할 수 있다.
 */
export { isEmptyEconomySnapshot } from './lib/economyCompleteness';
export {
    INDICATOR_NAME_KO,
    normalizeIndicatorName,
} from './lib/indicatorNameKo';
export type { NormalizedIndicatorName } from './lib/indicatorNameKo';
export type { EconomicCalendarEventWithAnalysis } from './model';
export { resolveCalendarSummary, resolveCalendarInterpretation } from './model';
export type { CalendarCountry } from './lib/economyCalendarConstants';
export { CALENDAR_COUNTRY_LABEL_KEY } from './lib/economyCalendarConstants';
// 타입만 재export — `api/getKrIndicatorCards`는 server-only지만 타입은 런타임을
// 끌고 오지 않는다. UI/훅은 슬라이스 barrel에서 타입을 받는다(MISTAKES §Architecture 0).
export type { KrIndicatorCard } from './api/getKrIndicatorCards';
