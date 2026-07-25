# ISR 태그 스토어 멀티 인스턴스 전파 — 실증 검증

- 일시: 2026-07-25 (감사 반영 후 2026-07-26 재실행)
- 대상: 브랜치 `feat/isr-tagstore-redis`
- 설계: [`../superpowers/specs/2026-07-25-isr-tagstore-multi-instance-design.md`](../superpowers/specs/2026-07-25-isr-tagstore-multi-instance-design.md)
- 결과: **27/27 PASS**

## 왜 실증이 필요한가

유닛 테스트는 전송 계층을 모킹한다. 따라서 세 가지가 **원리적으로 검증되지 않는다**:

1. **Upstash REST 와이어 포맷** — `ZADD ... GT`, `ZRANGE ... BYSCORE WITHSCORES`의 실제 문법
2. **프로세스 간 전파** — 이 변경의 존재 이유 그 자체
3. **전역 `fetch`를 타지 않는다는 것** — 배포 안정성 감사가 잡은 blocker의 회귀 방지

이 레포에는 "목이 실제로는 불가능한 형태를 흉내 내 승인된 수정이 프로덕션에선 死코드였던"
선례가 있다(SEO pre-warm 락에서 Upstash가 `'1'`을 숫자 `1`로 반환한 건).

## 실증 방법

- 실제 Upstash 인스턴스(`.env.local` 자격증명) 대상
- **프로덕션 키 오염 방지**: 와이어 포맷 검증은 전용 임시 키 `siglens:isr:__validation__`을 쓰고
  종료 시 `DEL`. 전파 검증은 실제 키를 쓰되 멤버를 전부 `__validation__:` 접두로 두고 종료 시
  `ZREM` + 잔여 0 확인
- **멀티 인스턴스 시뮬레이션**: `spawnSync`로 **별도 Node 프로세스**를 띄운다. 각 프로세스는
  자신의 빈 in-process Map으로 시작하고 같은 Upstash를 공유한다 = EC2 인스턴스 2대와 동일

스크립트: `verify-wire.mjs`, `verify-propagation.mjs` (세션 스크래치패드, 레포 미포함)

## A. 와이어 포맷 (14/14 PASS)

| ID | 검증 | 결과 |
|---|---|---|
| W0 | Upstash 설정 감지 | PASS |
| W1 | `ZADD` + `ZRANGE BYSCORE WITHSCORES` 왕복 | PASS |
| W2 | `GT` — 더 큰 score는 갱신 | PASS |
| W3 | **`GT` — 더 작은 score는 무시** | PASS |
| W4 | 하한 이상만 반환(증분 동기화의 근간) | PASS |
| W5 | 하한 경계 포함(inclusive) | PASS |
| W6 | `ZREMRANGEBYSCORE` 하한 미만 제거 | PASS |
| W7 | 620건 청크 분할 기록(500 초과 경로) | PASS |
| W8 | 변경분 없으면 빈 배열(정상 상태 비용) | PASS |
| W9 | 읽기 전용 토큰 설정 확인 | PASS |
| W11 | `TIME` — 서버 시각 조회 | PASS (로컬 대비 drift **2,202ms**) |
| W12 | `EXPIRE` — 키 TTL 설정(롤백 시 자연 소멸) | PASS |
| W13 | `rawLength`가 원본 원소 수를 보고 | PASS |
| W10 | 임시 키 정리(`EXISTS=0`) | PASS |

**W3이 가장 중요하다.** 늦게 도착한 오래된 타임스탬프가 최신 무효화를 덮어쓰면 이미 무효화된
엔트리가 fresh로 되살아난다. `GT` 플래그가 실제 Redis에서 이를 막는지는 목으로 증명할 수 없다.

**W11의 drift 2.2초가 설계 결정을 뒷받침한다.** 로컬 시계와 Redis 서버 시계는 실제로 어긋난다.
정리 하한(`ZREMRANGEBYSCORE`)을 로컬 시각에서 얻으면 시계가 앞선 인스턴스 하나가 **공유** 태그
로그 전체를 지워버릴 수 있어, 서버 `TIME`을 쓰도록 했다.

## B. 프로세스 간 전파 (13/13 PASS)

| ID | 검증 | 관측값 |
|---|---|---|
| P1 | 대조군 — 기록 전 새 프로세스는 태그를 모름 | `seen=0` |
| P2 | 인스턴스 A가 `CacheHandler.revalidateTag` 실행 | `at=1784991840744` |
| **P3** | **인스턴스 B(별도 프로세스, 빈 맵)가 A의 무효화를 인지** | **A기록 == B관측** |
| P4 | 무효화 이전 엔트리=stale, 이후=fresh 판정 | 양방향 정상 |
| P5 | 같은 인스턴스 read-your-writes 즉시 반영 | PASS |
| P6 | Upstash 미설정 → 로컬 전용 degrade(빌드 타임 경로) | Promise 미반환, 로컬 정상 |
| P7 | 원격 도달 불가 → throw 없이 로컬 유지(fail-open) | `threw=false` |
| P8 | 부트스트랩 후 판정 경로 왕복 없음 | 부트스트랩 137ms 1회 → **이후 0.46µs/회** |
| **P11** | **전역 `fetch`를 쓰지 않는다** | `globalThis.fetch=throw` 상태에서 정상 동작 |
| P12 | 그 무효화가 원격까지 도달 | `seen=true` |
| P13 | `ISR_TAG_SYNC_DISABLED=true` 킬스위치 | 로컬 전용 전환 확인 |
| P9/P10 | 실증 태그 정리 / 잔여 0 | `ZREM=3`, 잔여 `[]` |

**P3이 이 변경의 존재 이유다.** 기존 구현에서는 B가 A의 `revalidateTag`를 영원히 인지하지 못했다.

**P11이 감사가 잡은 blocker의 회귀 가드다.** 프로덕션에서 `globalThis.fetch`는 Next가 패치한
것이고, 캐시 핸들러가 그것을 호출하면 렌더의 work-unit store가 오염돼 **페이지가 ISR 캐시에
기록되지 않는다**(그리고 `cacheComponents` 활성 시엔 영원히 pending). 전역 `fetch`를 예외를
던지는 함수로 갈아끼운 프로세스에서 전파가 정상 동작한다 = 전역 `fetch`를 타지 않는다는 증명.

**P8이 설계의 핵심 제약을 지켰음을 보인다.** `maxRevalidatedAt`은 캐시 `get()`마다 불리므로
여기에 네트워크가 들어가면 모든 캐시 히트에 왕복이 붙는다. 부트스트랩 1회를 제외하면 호출당
0.46µs로 기존 로컬 Map 접근과 사실상 동일하다.

## C. 회귀 게이트

| 게이트 | 결과 |
|---|---|
| `yarn test` (전체) | 실패 0 |
| `yarn build` | exit 0, 정적 페이지 31개 생성 |
| `npx eslint cache-handler/` | exit 0 |
| `npx prettier --check` | 통과 |

빌드 로그에 `[isr-cache] tag ...` 오류가 없다 — prerender 중 태그 스토어가 설계대로 no-op이었다.

## D. 알려진 미검증 영역

- **실제 EC2 2대 동시 운영**: 별도 프로세스로 시뮬레이션했으나 실제 ASG 스케일아웃 하에서의
  검증은 배포 후에만 가능하다. 전파 메커니즘 자체가 프로세스 경계를 넘는 것은 확인됐다
- **네트워크 지연**: 로컬↔Upstash 왕복이 137ms였다. EC2(ap-northeast-2)↔Upstash 지연은 배포 후
  실측 필요. hot path가 아니라 백그라운드 sync라 영향은 제한적이며, 부트스트랩 대기는 1초로
  상한이 걸려 있다
- **재생성 중 무효화 창**(설계 §7): 구조적으로 남는 창이라 실증 대상이 아니다
