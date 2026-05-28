# Redis 클라이언트 통합 설계

- 작성일: 2026-05-28
- 상태: 설계 승인 완료 (구현 계획 작성 대기)
- 관련: 원래 사용자 요청 "문제 2 — getRedis 등 공통 함수 통합" · `src/shared/CLAUDE.md`(`shared/cache/` = Redis client)

## 1. 배경 / 문제

siglens 앱이 Upstash Redis 클라이언트를 **5곳에서 각자 생성**한다. 모두 동일한
`UPSTASH_REDIS_REST_*` 환경변수를 읽어 `new Redis(...)`를 만들며, 3곳은 사실상 복붙이다.
관리 지점이 분산되어 있어 연결 설정·graceful fallback 정책을 한 곳에서 바꿀 수 없다.

> 범위 확인: DB(`shared/db/getDatabaseClient`), FMP(`shared/api/fmp/httpClient.fmpGet`),
> yahoo-finance2(`options-chain`의 단일 `YahooOptionsAdapter`), AI provider(`entities/llm-provider/api`의
> SDK별 단일 생성점), Email(`shared/email/dispatcher`의 단일 `Resend`)은 **이미 단일화**되어 있어
> 본 작업 대상이 아니다. core의 `createCacheProvider`(분석 캐시)는 core 소유로 유지한다(SCOPE).

## 2. 현황 인벤토리 (분산 5곳)

| # | 파일 | 현재 패턴 |
|---|---|---|
| 1 | `src/entities/options-chain/lib/optionsDataCache.ts` | `getRedis(): Redis \| null` lazy 싱글톤, env 미설정 시 null |
| 2 | `src/entities/news-article/lib/newsRefreshFlag.ts` | 동일 `getRedis()` (복붙) |
| 3 | `src/entities/bars/lib/barsDataCache.ts` | 동일 `getRedis()` (복붙) |
| 4 | `src/entities/oauth-account/lib/pendingOAuthSignupStore.ts` | `createPendingOAuthSignupStoreFromEnv()`가 매 호출 `new Redis`(캐싱 없음) |
| 5 | `src/entities/email-token/api.ts` | `getRedisPair()` writer/reader 쌍(`UPSTASH_REDIS_REST_READONLY_TOKEN`) + config-key 무효화 |

모두 `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`(+ #5는 `_READONLY_TOKEN`)을 직접 읽는다.

## 3. 설계 — `src/shared/cache/redisClient.ts` (신규)

Upstash Redis 생성과 env 읽기를 단일 모듈로 일원화한다. (FSD: `shared`는 최하위 레이어 —
모든 entity가 `@/shared/cache`에서 import 가능. 레이어 위반 없음.)

```ts
import { Redis } from '@upstash/redis';

interface UpstashEnv {
    url: string;
    token: string;
    readonlyToken: string | null; // 빈 문자열/미설정은 null로 정규화
}

let cachedWriter: Redis | null | undefined;       // undefined = 미초기화, null = env 미설정
let cachedReader: Redis | null | undefined;

function readUpstashEnv(): UpstashEnv | null {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) return null;
    const raw = process.env.UPSTASH_REDIS_REST_READONLY_TOKEN;
    const readonlyToken = raw === undefined || raw === '' ? null : raw;
    return { url, token, readonlyToken };
}

/**
 * 앱 공용 Upstash Redis writer 클라이언트(싱글톤). env 미설정 시 `null`을 반환해
 * 소비자가 graceful degrade(캐시 미스/직접 호출)할 수 있게 한다.
 */
export function getRedisClient(): Redis | null {
    if (cachedWriter !== undefined) return cachedWriter;
    const env = readUpstashEnv();
    cachedWriter = env ? new Redis({ url: env.url, token: env.token }) : null;
    return cachedWriter;
}

/**
 * writer/reader 쌍(싱글톤). `UPSTASH_REDIS_REST_READONLY_TOKEN`이 있으면 reader는
 * read-only 토큰을 쓰고, 없으면 `reader === writer`. writer는 `getRedisClient()`와
 * 동일 인스턴스를 공유한다(중복 생성 방지). env 미설정 시 `null`.
 */
export function getRedisReaderWriter(): { writer: Redis; reader: Redis } | null {
    const writer = getRedisClient();
    if (writer === null) return null;
    if (cachedReader === undefined) {
        const env = readUpstashEnv(); // writer가 non-null이므로 env도 non-null
        cachedReader =
            env && env.readonlyToken !== null
                ? new Redis({ url: env.url, token: env.readonlyToken })
                : writer;
    }
    return { writer, reader: cachedReader ?? writer };
}

/** @internal 테스트 간 싱글톤 초기화. */
export function __resetRedisClientForTests(): void {
    cachedWriter = undefined;
    cachedReader = undefined;
}
```

핵심 속성:
- **null fallback 보존**: env 미설정(로컬 dev 등) 시 `null` — 기존 소비자의 null 체크가 그대로 동작.
- **싱글톤**: 요청/모듈 수명 동안 writer·reader를 재사용. oauth는 기존에 매 호출 `new Redis`였으나
  이제 싱글톤 재사용(부수 개선).
- **writer 공유**: `getRedisReaderWriter().writer`와 `getRedisClient()`는 동일 인스턴스.

## 4. 마이그레이션 (소비자 5곳 — 도메인 로직 불변, client 생성만 교체)

각 파일에서 로컬 env 읽기 + `new Redis` 생성만 제거하고 shared 모듈을 import한다.
key 빌더 / TTL / store 인터페이스 / try-catch graceful 처리는 **그대로 유지**.

1. **optionsDataCache.ts**: 로컬 `getRedis()`(+`cachedRedis`) 삭제 → `import { getRedisClient } from '@/shared/cache/redisClient'`. 본문 `getRedis()` → `getRedisClient()`. `import { Redis }` 제거.
2. **newsRefreshFlag.ts**: 동일.
3. **barsDataCache.ts**: 동일.
4. **pendingOAuthSignupStore.ts**: `createPendingOAuthSignupStoreFromEnv()`의 env 읽기 + `new Redis`를 `getRedisClient()`로 교체(null이면 기존대로 null 반환). `createPendingOAuthSignupStore(client: Redis)`(주입형)는 그대로 둔다.
5. **email-token/api.ts**: 로컬 `readUpstashConfig()` + `getRedisPair()` + `UpstashConfig`/`RedisPair`/캐시 변수 삭제 → `import { getRedisReaderWriter } from '@/shared/cache/redisClient'`. `createEmailTokenStore()`에서 `const pair = getRedisReaderWriter(); if (!pair) return null; const { writer, reader } = pair;`. `EmailTokenStore` 인터페이스·`buildEmailTokenKey`·`__resetEmailTokenStoreCacheForTests`(또는 shared reset로 위임)는 유지.

## 5. 보존 / 비목표

- 보존: 각 소비자의 graceful null 처리, key 네임스페이스, TTL, store 인터페이스.
- 비목표: DB/FMP/yahoo/AI/Email 통합(이미 단일), core `createCacheProvider`(core 소유), Redis 명령 사용 방식 변경, 캐시 키/TTL 정책 변경.

## 6. 테스트

- 신규 `src/shared/cache/__tests__/redisClient.test.ts`:
  - env 미설정 → `getRedisClient()`·`getRedisReaderWriter()` 모두 `null`.
  - env 설정 → `getRedisClient()` 반복 호출이 **동일 인스턴스**(싱글톤).
  - readonly token 설정 → `getRedisReaderWriter().reader !== .writer`, 그리고 `.writer === getRedisClient()`.
  - readonly token 미설정 → `.reader === .writer`.
  - 각 테스트 전 `__resetRedisClientForTests()` + `process.env` 제어(`@upstash/redis`의 `Redis`는 mock 또는 instanceof 확인).
- 소비자 테스트 5곳: 로컬 `getRedis`/`getRedisPair` mock을 `vi.mock('@/shared/cache/redisClient', ...)`로 전환. 기존 동작 단언(캐시 hit/miss, null fallback, writer/reader 사용)은 그대로 유지·통과.

## 7. 영향 / 리스크

- 순수 내부 리팩토링 — 외부 동작(캐시 동작, env 계약) 불변.
- env 계약 동일(`UPSTASH_REDIS_REST_URL`/`_TOKEN`/`_READONLY_TOKEN`).
- oauth만 "매 호출 new" → "싱글톤"으로 바뀌어 연결 재사용(개선, 동작 동일).
- `__resetEmailTokenStoreCacheForTests`가 로컬 캐시를 리셋하던 부분은 shared `__resetRedisClientForTests`로 대체 또는 위임 필요(테스트 격리 유지).
