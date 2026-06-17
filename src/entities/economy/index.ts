/**
 * entities/economy public barrel.
 *
 * 외부 layer(`app/`, `widgets/`)는 이 barrel을 통해서만 entity의 lib/ 헬퍼를 import한다
 * (CLAUDE.md "production 코드는 슬라이스 barrel(index.ts)만 import"). server-only 의존성을
 * 가진 api/ 모듈(`economySnapshotStaticCache`, `macroBriefingStaticCache`, `economySnapshotCache`)과
 * Server Action(`actions/*`)은 client 번들 누출 방지를 위해 barrel 제외 — 호출부가 deep
 * path로 직접 import한다(entities/CLAUDE.md "barrel 제외 대상" 규칙).
 */
export { isEmptyEconomySnapshot } from './lib/economyCompleteness';
