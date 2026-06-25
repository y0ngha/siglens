# Spec-3 — entities `user` ⇄ `session` 사이클 해소

- 작성일: 2026-06-25
- 상태: 설계(방향) — 전용 brainstorming/plan에서 택1
- 선행: 메인 spec의 P0~P2 안정화 후 착수
- 위험도: 중~고 (auth 도메인 전반 import 경로 이동)

## 문제

cross-cutting 감사가 확인한 entity import 사이클:

- `entities/user/lib/*`(7파일, 예 `loginUser.ts:3`) → `@/entities/session/lib/tokenUtils`·`sessionCookie`.
- `entities/session/lib/getCurrentUser.ts:4` → `@/entities/user`(`DrizzleUserRepository`, `findUserBySessionToken`).

barrel 순환 초기화를 피하려 **deep `lib/` 경로로만** 결합돼 acyclic하게 유지 중. 도메인상 session과 user는 인증에서 본질적으로 결합(`entities/CLAUDE.md` 문서화).

## 현재 ESLint 예외 (부분 재봉인 대상)

`eslint.config.mjs`:

- 164-172행: `from: { type: 'entities' }, allow: [{ to: { type: 'entities' } }, …]`.
  - ⚠️ **이 룰은 user/session 전용이 아니다.** `analysis → news-article/earnings-report/options/financials`(overall 멀티엔티티 조합)에도 필요. → **룰 전체 제거 불가.**
- 205-206행: `no-restricted-imports`의 `src/entities/*/lib/**` ignore — entities lib 간 deep cross-import 허용. user↔session 결합이 여기 의존.

## 접근 (택1 — 전용 brainstorming에서 트레이드오프 비교)

### 안 A — `entities/auth`로 병합

- `user` + `session`을 단일 `entities/auth` 슬라이스로 통합. 내부 결합은 슬라이스 내부가 되어 cross-import 자체가 소멸.
- 장점: 사이클 근본 제거, barrel 사용 가능(deep `lib/` 경로 탈피).
- 단점: 큰 이동(user/session 소비처 다수 — `user` 28 imports, `session` 23 imports). public API 재설계.

### 안 B — 결합 공식 인정(문서화)

- 구조 이동 없이 user↔session deep-path 결합을 의도된 예외로 공식화(ESLint 주석/문서).
- 장점: 저위험·저비용.
- 단점: 사이클 잔존, "deep `lib/` 경로 강제"라는 냄새 유지.

## 재봉인 (안 A 완료 시 — 제한적)

- `entities → entities` allow 룰은 **유지**(analysis 조합 필요).
- `src/entities/*/lib/**` ignore에서 user↔session 결합분이 사라지나, 다른 entities lib cross-import(있다면) 잔존 여부 실측 후 ignore 축소 범위 결정.
- 즉 Spec-3의 재봉인은 "룰 삭제"가 아니라 **user/session 결합 제거 + ignore 범위 정밀화**.

## Behavior-preservation

- 순수 구조 이동: 인증 흐름(로그인/세션/OAuth) 동작·반환 동일. import 경로/슬라이스 경계만 변경.
- auth는 E2E(Tier 1~4)로 커버 → 단계별 전체 test+build+e2e 게이트.

## 비범위

- 인증 정책/세션 수명/쿠키 동작 변경 없음. 순수 슬라이스 재배치.
