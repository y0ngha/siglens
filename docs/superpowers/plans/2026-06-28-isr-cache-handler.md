# ISR Cache Handler (S3 외부화) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Next.js 16.2 ISR/fetch 캐시를 컨테이너 디스크 대신 S3로 외부화해 디스크풀 장애를 원천 차단한다.

**Architecture:** 커스텀 `cacheHandler`(단수)가 페이로드를 S3에 gzip 저장하고, 태그 무효화는 핸들러 메모리의 로컬 맵으로 처리(soft invalidation). 배포 무효화는 `GIT_SHA` prefix 전환으로 자동. DynamoDB 없음(단일 인스턴스).

**Tech Stack:** Next.js 16.2 (`cacheHandler` 단수), `@aws-sdk/client-s3`, Node `zlib`, vitest, ESM(`.mjs`).

**Spec:** `docs/superpowers/specs/2026-06-28-isr-cache-handler-design.md`

---

## File Structure

```
cache-handler/
  index.mjs         CacheHandler 클래스 (get/set/revalidateTag/resetRequestCache 오케스트레이터)
  config.mjs        env 읽기 (bucket, region, keyPrefix, buildId)
  serialize.mjs     gzip 직렬화/역직렬화
  s3Store.mjs       S3 get/set (키 스킴 + NoSuchKey→null + fail-open)
  tagStore.mjs      로컬 in-process Map<tag, revalidatedAt>
  __tests__/
    serialize.test.mjs
    tagStore.test.mjs
    s3Store.test.mjs
    index.test.mjs
next.config.ts       (수정) cacheHandler 등록 + cacheMaxMemorySize:0
Dockerfile           (수정) cache-handler/ + @aws-sdk COPY + require.resolve 검증 + GIT_SHA ARG
package.json         (수정) @aws-sdk/client-s3 추가
infra/aws/12-isr-cache.sh   (생성) S3 버킷 + lifecycle
infra/aws/00-iam-setup.sh   (수정) EC2 role에 S3 권한
.github/workflows/deploy.yml (수정) GIT_SHA 전달
infra/aws/deploy.sh          (수정) 옛 prefix 정리
```

루트 `cache-handler/` 디렉토리에 모은다(Next 인프라 모듈이라 FSD 레이어 밖). `next.config`는 `require.resolve('./cache-handler/index.mjs')`로 참조한다.

---

## Task 1: AWS SDK 의존성 + config 모듈

**Files:**
- Modify: `package.json`
- Create: `cache-handler/config.mjs`

- [ ] **Step 1: AWS SDK 설치**

Run: `yarn add @aws-sdk/client-s3`
Expected: `package.json` dependencies에 `@aws-sdk/client-s3` 추가, `yarn.lock` 갱신

- [ ] **Step 2: config 모듈 작성**

Create `cache-handler/config.mjs`:
```js
// ISR 캐시 핸들러 설정. 모든 값은 런타임 env에서 읽는다.
// buildId(GIT_SHA)는 배포 격리용 S3 prefix — 배포마다 prefix가 갈려 옛 캐시가 자동 무효화된다.
export const config = {
  bucket: process.env.ISR_CACHE_BUCKET,
  region: process.env.AWS_REGION || 'ap-northeast-2',
  keyPrefix: 'siglens-isr',
  buildId: process.env.GIT_SHA || 'dev',
  disabled: process.env.ISR_CACHE_DISABLED === 'true',
};
```

- [ ] **Step 3: 커밋**

```bash
git add package.json yarn.lock cache-handler/config.mjs
git commit -m "feat(isr-cache): add aws-sdk dependency and config module"
```

---

## Task 2: serialize 모듈 (gzip)

**Files:**
- Create: `cache-handler/serialize.mjs`
- Test: `cache-handler/__tests__/serialize.test.mjs`

- [ ] **Step 1: 실패하는 테스트 작성**

Create `cache-handler/__tests__/serialize.test.mjs`:
```js
import { describe, it, expect } from 'vitest';
import { serialize, deserialize } from '../serialize.mjs';

describe('serialize', () => {
  it('gzip 왕복이 원본과 동치다', () => {
    const obj = { value: { html: 'x'.repeat(1000) }, lastModified: 123, tags: ['symbol:AAPL'] };
    const buf = serialize(obj);
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(deserialize(buf)).toEqual(obj);
  });

  it('빈 객체도 왕복된다', () => {
    expect(deserialize(serialize({}))).toEqual({});
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `yarn vitest run cache-handler/__tests__/serialize.test.mjs`
Expected: FAIL — `serialize.mjs` 모듈 없음

- [ ] **Step 3: 구현**

Create `cache-handler/serialize.mjs`:
```js
import { gzipSync, gunzipSync } from 'node:zlib';

// RSC/HTML 페이로드가 커서 gzip 필수. 메타(lastModified/tags 등)도 함께 직렬화한다.
export function serialize(obj) {
  return gzipSync(Buffer.from(JSON.stringify(obj)));
}

export function deserialize(buf) {
  return JSON.parse(gunzipSync(buf).toString('utf-8'));
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `yarn vitest run cache-handler/__tests__/serialize.test.mjs`
Expected: PASS (2 passed)

> 만약 vitest가 `cache-handler/**/*.test.mjs`를 수집하지 않으면 `vitest.config.ts`의 `test.include`에 `'cache-handler/**/*.test.mjs'`를 추가하고 다시 실행한다.

- [ ] **Step 5: 커밋**

```bash
git add cache-handler/serialize.mjs cache-handler/__tests__/serialize.test.mjs
git commit -m "feat(isr-cache): gzip serialize module"
```

---

## Task 3: tagStore 모듈 (로컬 태그맵)

**Files:**
- Create: `cache-handler/tagStore.mjs`
- Test: `cache-handler/__tests__/tagStore.test.mjs`

- [ ] **Step 1: 실패하는 테스트 작성**

Create `cache-handler/__tests__/tagStore.test.mjs`:
```js
import { describe, it, expect, beforeEach } from 'vitest';
import { markRevalidated, maxRevalidatedAt, _resetForTest } from '../tagStore.mjs';

describe('tagStore', () => {
  beforeEach(() => _resetForTest());

  it('미등록 태그는 0을 반환한다(fresh)', () => {
    expect(maxRevalidatedAt(['symbol:AAPL'])).toBe(0);
  });

  it('revalidate된 태그의 타임스탬프를 반환한다(read-your-writes)', () => {
    markRevalidated('news:AAPL', 1000);
    expect(maxRevalidatedAt(['news:AAPL'])).toBe(1000);
  });

  it('여러 태그 중 최댓값을 반환한다', () => {
    markRevalidated('a', 1000);
    markRevalidated('b', 2000);
    expect(maxRevalidatedAt(['a', 'b', 'c'])).toBe(2000);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `yarn vitest run cache-handler/__tests__/tagStore.test.mjs`
Expected: FAIL — `tagStore.mjs` 없음

- [ ] **Step 3: 구현**

Create `cache-handler/tagStore.mjs`:
```js
// 로컬 in-process 태그 무효화 맵 (soft invalidation).
// 단일 인스턴스(ASG desired=1)라 로컬 맵이 source of truth. revalidateTag가 즉시 기록해
// 같은 인스턴스의 후속 get에서 read-your-writes가 보장된다.
//
// 확장 경로(spec §8): 멀티 인스턴스 전파가 필요해지면
//   1차 → S3 태그 마커(siglens-isr/tags/{tag}에 revalidatedAt 객체)
//   2차 → DynamoDB 태그 스토어
// 로 교체한다. 현재는 의도적으로 로컬 맵만 둔다.
//
// 메모리: revalidateTag된 태그만 누적되며 심볼 유니버스가 유한해 상한이 수만 엔트리(~수 MB).
// 우려 시 LRU 도입.
const revalidatedAt = new Map();

export function markRevalidated(tag, now) {
  revalidatedAt.set(tag, now);
}

export function maxRevalidatedAt(tags) {
  let max = 0;
  for (const tag of tags) {
    const t = revalidatedAt.get(tag);
    if (t && t > max) max = t;
  }
  return max;
}

// 테스트 전용 — 맵 초기화.
export function _resetForTest() {
  revalidatedAt.clear();
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `yarn vitest run cache-handler/__tests__/tagStore.test.mjs`
Expected: PASS (3 passed)

- [ ] **Step 5: 커밋**

```bash
git add cache-handler/tagStore.mjs cache-handler/__tests__/tagStore.test.mjs
git commit -m "feat(isr-cache): local in-process tag store"
```

---

## Task 4: s3Store 모듈

**Files:**
- Create: `cache-handler/s3Store.mjs`
- Test: `cache-handler/__tests__/s3Store.test.mjs`

- [ ] **Step 1: 실패하는 테스트 작성**

Create `cache-handler/__tests__/s3Store.test.mjs`:
```js
import { describe, it, expect, vi, beforeEach } from 'vitest';

const send = vi.fn();
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn(() => ({ send })),
  GetObjectCommand: vi.fn((input) => ({ __type: 'get', input })),
  PutObjectCommand: vi.fn((input) => ({ __type: 'put', input })),
}));
vi.mock('../config.mjs', () => ({
  config: { bucket: 'test-bucket', region: 'ap-northeast-2', keyPrefix: 'siglens-isr', buildId: 'sha123' },
}));

import { getEntry, setEntry, s3KeyForTest } from '../s3Store.mjs';
import { serialize } from '../serialize.mjs';

beforeEach(() => send.mockReset());

describe('s3Store key scheme', () => {
  it('pages/fetch kind를 prefix로 분리하고 buildId를 포함한다', () => {
    expect(s3KeyForTest('/AAPL', 'APP_PAGE')).toBe('siglens-isr/sha123/pages/%2FAAPL.cache');
    expect(s3KeyForTest('/AAPL', 'FETCH')).toBe('siglens-isr/sha123/fetch/%2FAAPL.cache');
  });
});

describe('getEntry', () => {
  it('NoSuchKey는 null을 반환한다(정상 miss)', async () => {
    send.mockRejectedValueOnce(Object.assign(new Error('nope'), { name: 'NoSuchKey' }));
    expect(await getEntry('/AAPL', 'APP_PAGE')).toBeNull();
  });

  it('기타 에러도 null을 반환한다(fail-open)', async () => {
    send.mockRejectedValueOnce(Object.assign(new Error('timeout'), { name: 'TimeoutError' }));
    expect(await getEntry('/AAPL', 'APP_PAGE')).toBeNull();
  });

  it('저장된 엔트리를 역직렬화해 반환한다', async () => {
    const entry = { value: { html: 'hi' }, lastModified: 5, tags: ['t'] };
    const body = serialize(entry);
    send.mockResolvedValueOnce({ Body: { transformToByteArray: async () => body } });
    expect(await getEntry('/AAPL', 'APP_PAGE')).toEqual(entry);
  });
});

describe('setEntry', () => {
  it('PutObject로 직렬화해 저장한다', async () => {
    send.mockResolvedValueOnce({});
    await setEntry('/AAPL', 'APP_PAGE', { value: 1, lastModified: 9, tags: [] });
    expect(send).toHaveBeenCalledOnce();
    expect(send.mock.calls[0][0].input.Key).toBe('siglens-isr/sha123/pages/%2FAAPL.cache');
  });

  it('S3 에러를 삼킨다(fail-open, throw 안 함)', async () => {
    send.mockRejectedValueOnce(new Error('s3 down'));
    await expect(setEntry('/AAPL', 'APP_PAGE', { value: 1, lastModified: 9, tags: [] })).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `yarn vitest run cache-handler/__tests__/s3Store.test.mjs`
Expected: FAIL — `s3Store.mjs` 없음

- [ ] **Step 3: 구현**

Create `cache-handler/s3Store.mjs`:
```js
import { createHash } from 'node:crypto';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { serialize, deserialize } from './serialize.mjs';
import { config } from './config.mjs';

let client;
function s3() {
  // EC2 instance role 자격증명 자동 사용. region만 지정.
  client ??= new S3Client({ region: config.region });
  return client;
}

function s3Key(key, kind) {
  const sub = kind === 'FETCH' ? 'fetch' : 'pages';
  let id = encodeURIComponent(key);
  // S3 키 1024바이트 한계 — 초과 시 sha256으로 대체(고유성 보존).
  if (Buffer.byteLength(id) > 900) id = createHash('sha256').update(key).digest('hex');
  return `${config.keyPrefix}/${config.buildId}/${sub}/${id}.cache`;
}

export async function getEntry(key, kind) {
  try {
    const res = await s3().send(new GetObjectCommand({ Bucket: config.bucket, Key: s3Key(key, kind) }));
    const buf = Buffer.from(await res.Body.transformToByteArray());
    return deserialize(buf);
  } catch (e) {
    if (e.name === 'NoSuchKey' || e.$metadata?.httpStatusCode === 404) return null;
    console.error('[isr-cache] s3 get failed', key, e.name, e.message);
    return null; // fail-open: 재생성
  }
}

export async function setEntry(key, kind, entry) {
  try {
    await s3().send(new PutObjectCommand({
      Bucket: config.bucket,
      Key: s3Key(key, kind),
      Body: serialize(entry),
    }));
  } catch (e) {
    console.error('[isr-cache] s3 set failed', key, e.name, e.message); // 응답 flush 후라 삼킴
  }
}

// 테스트 전용 — 키 스킴 검증.
export const s3KeyForTest = s3Key;
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `yarn vitest run cache-handler/__tests__/s3Store.test.mjs`
Expected: PASS (6 passed)

- [ ] **Step 5: 커밋**

```bash
git add cache-handler/s3Store.mjs cache-handler/__tests__/s3Store.test.mjs
git commit -m "feat(isr-cache): s3 store with key scheme and fail-open"
```

---

## Task 5: cache-handler 오케스트레이터

**Files:**
- Create: `cache-handler/index.mjs`
- Test: `cache-handler/__tests__/index.test.mjs`

- [ ] **Step 1: 실패하는 테스트 작성**

Create `cache-handler/__tests__/index.test.mjs`:
```js
import { describe, it, expect, vi, beforeEach } from 'vitest';

const getEntry = vi.fn();
const setEntry = vi.fn();
vi.mock('../s3Store.mjs', () => ({ getEntry: (...a) => getEntry(...a), setEntry: (...a) => setEntry(...a) }));
vi.mock('../config.mjs', () => ({ config: { disabled: false } }));

import CacheHandler from '../index.mjs';
import { _resetForTest, markRevalidated } from '../tagStore.mjs';

beforeEach(() => { getEntry.mockReset(); setEntry.mockReset(); _resetForTest(); });

describe('CacheHandler.get', () => {
  it('miss면 null', async () => {
    getEntry.mockResolvedValueOnce(null);
    expect(await new CacheHandler({}).get('/AAPL', { kind: 'APP_PAGE' })).toBeNull();
  });

  it('태그가 revalidate되지 않았으면 value 반환(hit)', async () => {
    getEntry.mockResolvedValueOnce({ value: { html: 'hi' }, lastModified: 1000, tags: ['news:AAPL'] });
    expect(await new CacheHandler({}).get('/AAPL', { kind: 'APP_PAGE' })).toEqual({ html: 'hi' });
  });

  it('태그가 lastModified 이후 revalidate됐으면 null(stale)', async () => {
    markRevalidated('news:AAPL', 2000);
    getEntry.mockResolvedValueOnce({ value: { html: 'old' }, lastModified: 1000, tags: ['news:AAPL'] });
    expect(await new CacheHandler({}).get('/AAPL', { kind: 'APP_PAGE' })).toBeNull();
  });
});

describe('CacheHandler.set', () => {
  it('lastModified와 tags를 담아 저장한다', async () => {
    const before = Date.now();
    await new CacheHandler({}).set('/AAPL', { html: 'x' }, { kind: 'APP_PAGE', tags: ['news:AAPL'] });
    expect(setEntry).toHaveBeenCalledOnce();
    const [key, kind, entry] = setEntry.mock.calls[0];
    expect(key).toBe('/AAPL');
    expect(kind).toBe('APP_PAGE');
    expect(entry.value).toEqual({ html: 'x' });
    expect(entry.tags).toEqual(['news:AAPL']);
    expect(entry.lastModified).toBeGreaterThanOrEqual(before);
  });
});

describe('CacheHandler.revalidateTag', () => {
  it('string과 string[] 모두 처리한다(read-your-writes)', async () => {
    const h = new CacheHandler({});
    await h.revalidateTag('news:AAPL');
    await h.revalidateTag(['symbol:TSLA']);
    getEntry.mockResolvedValue({ value: 'v', lastModified: 0, tags: ['news:AAPL'] });
    expect(await h.get('/x', { kind: 'APP_PAGE' })).toBeNull(); // revalidatedAt > 0 > lastModified
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `yarn vitest run cache-handler/__tests__/index.test.mjs`
Expected: FAIL — `index.mjs` 없음

- [ ] **Step 3: 구현**

Create `cache-handler/index.mjs`:
```js
import { getEntry, setEntry } from './s3Store.mjs';
import { markRevalidated, maxRevalidatedAt } from './tagStore.mjs';
import { config } from './config.mjs';

// Next.js 16.2 단수 cacheHandler (incremental-cache/index.d.ts 계약).
// 메서드: get / set / revalidateTag(tags, durations?) / resetRequestCache.
// refreshTags 훅은 단수 핸들러에 없으므로(그건 cacheHandlers 복수=use cache 전용),
// 멀티 인스턴스 태그 검증은 get() 내부에서 수행한다.
export default class CacheHandler {
  constructor(ctx) {
    this.ctx = ctx;
  }

  async get(cacheKey, ctx) {
    if (config.disabled) return null; // 런타임 비상 킬스위치
    const entry = await getEntry(cacheKey, ctx?.kind);
    if (!entry) return null;
    // soft invalidation: 엔트리 태그 중 하나라도 lastModified 이후 revalidate됐으면 stale.
    if (maxRevalidatedAt(entry.tags || []) > entry.lastModified) return null;
    return entry.value;
  }

  async set(cacheKey, data, ctx) {
    if (config.disabled) return;
    await setEntry(cacheKey, ctx?.kind, {
      value: data,
      lastModified: Date.now(),
      tags: ctx?.tags || [],
      kind: ctx?.kind,
    });
  }

  // durations(Next16 SWR profile)는 soft invalidation에선 무시하고 now만 기록한다.
  async revalidateTag(tags) {
    const arr = Array.isArray(tags) ? tags : [tags];
    const now = Date.now();
    for (const tag of arr) markRevalidated(tag, now);
  }

  resetRequestCache() {} // 로컬 태그맵은 per-request 상태가 아니므로 no-op
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `yarn vitest run cache-handler/__tests__/index.test.mjs`
Expected: PASS (5 passed)

- [ ] **Step 5: 커밋**

```bash
git add cache-handler/index.mjs cache-handler/__tests__/index.test.mjs
git commit -m "feat(isr-cache): cache handler orchestrator"
```

---

## Task 6: next.config 와이어링

**Files:**
- Modify: `next.config.ts`

- [ ] **Step 1: createRequire + cacheHandler 등록**

`next.config.ts` 상단 import에 추가:
```ts
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
```

`nextConfig` 객체에 추가 (기존 `output: 'standalone'` 근처):
```ts
  // ISR/fetch 캐시를 S3로 외부화(디스크풀 방지). production + 버킷 설정 시에만 등록.
  // dev/E2E(버킷 없음)는 기본 파일시스템 캐시로 동작.
  cacheHandler:
    process.env.NODE_ENV === 'production' && process.env.ISR_CACHE_BUCKET
      ? require.resolve('./cache-handler/index.mjs')
      : undefined,
  // 멀티 인스턴스 정합성: 인스턴스 로컬 L1 캐시를 끄고 모든 read/write를 핸들러로.
  cacheMaxMemorySize: 0,

  // ⚠️ next/image 최적화 캐시(IMAGE kind)는 디스크에 유지한다(정적 에셋이라 작음, ~8KB).
  // images.customCacheHandler를 true로 켜지 말 것 — IMAGE까지 S3로 보내면 불필요한
  // 비용/복잡도만 늘고 디스크풀과 무관하다(외부화 대상에서 의도적 제외, spec §4.2).

  // cache-handler 모듈을 standalone 트레이스에 강제 포함(E2E 빌드는 cacheHandler 미등록이라
  // 자동 트레이싱되지 않을 수 있음).
  outputFileTracingIncludes: {
    '/**': ['./skills/**/*', './cache-handler/**/*'],
  },
```

> 주의: 기존 `outputFileTracingIncludes`에 이미 `'/**': ['./skills/**/*']`가 있으므로, **중복 키를 만들지 말고** 기존 배열에 `'./cache-handler/**/*'`를 추가한다.

- [ ] **Step 2: 타입체크 + 빌드 확인**

Run: `yarn typecheck`
Expected: PASS (타입 에러 없음)

- [ ] **Step 3: 커밋**

```bash
git add next.config.ts
git commit -m "feat(isr-cache): wire cacheHandler in next.config (prod+bucket gated)"
```

---

## Task 7: Dockerfile 번들링 + GIT_SHA

**Files:**
- Modify: `Dockerfile`

- [ ] **Step 1: GIT_SHA ARG/ENV + cache-handler·SDK COPY + 검증**

`Dockerfile` builder 스테이지의 `ARG NEXT_PUBLIC_*` 근처에 추가:
```dockerfile
ARG GIT_SHA
ENV GIT_SHA=$GIT_SHA
```

runner 스테이지에서 sharp COPY 라인들 뒤에 추가:
```dockerfile
# ISR 캐시 핸들러 + AWS SDK는 standalone에 자동 트레이싱되지 않을 수 있어 명시 복사.
COPY --chown=node:node --from=builder /app/cache-handler ./cache-handler
COPY --chown=node:node --from=builder /app/node_modules/@aws-sdk ./node_modules/@aws-sdk
# 누락 시 즉시 실패(런타임 ENOSPC 회피보다 빌드 실패가 낫다).
RUN node -e "require.resolve('@aws-sdk/client-s3')" || (echo 'FAIL: @aws-sdk/client-s3 누락' && exit 1)
RUN node -e "require('node:fs').accessSync('./cache-handler/index.mjs')" || (echo 'FAIL: cache-handler 누락' && exit 1)
```

> `@aws-sdk`는 의존 패키지(`@smithy/*` 등)가 있으므로, `require.resolve` 검증이 통과하는지 반드시 확인한다. 실패 시 `@smithy`도 명시 COPY 추가.

- [ ] **Step 2: 로컬 prod 이미지 빌드로 검증**

Run: `GIT_SHA=testsha docker build --secret id=SIGLENS_GITHUB_TOKEN,env=SIGLENS_GITHUB_TOKEN --secret id=DATABASE_URL,env=DATABASE_URL --secret id=FMP_API_KEY,env=FMP_API_KEY -t siglens-isr-test . 2>&1 | tail -20`
Expected: 빌드 성공, `require.resolve` 검증 라인 통과 (실패 시 위 주석대로 @smithy COPY 추가)

- [ ] **Step 3: 커밋**

```bash
git add Dockerfile
git commit -m "feat(isr-cache): bundle cache-handler and aws-sdk into standalone image"
```

---

## Task 8: 인프라 — S3 버킷 + IAM

**Files:**
- Create: `infra/aws/12-isr-cache.sh`
- Modify: `infra/aws/00-iam-setup.sh`

- [ ] **Step 1: S3 버킷 + lifecycle 스크립트 작성**

Create `infra/aws/12-isr-cache.sh`:
```bash
#!/usr/bin/env bash
# ISR 캐시 S3 버킷(idempotent). 전체 14일 균일 만료로 미방문 캐시를 자동 정리(디스크풀 방지).
set -euo pipefail
source "$(dirname "$0")/lib.sh"; source "$(dirname "$0")/.env"
REGION="${AWS_REGION:-ap-northeast-2}"
BUCKET="${ISR_CACHE_BUCKET:-siglens-isr-cache}"

if ! aws s3api head-bucket --bucket "$BUCKET" 2>/dev/null; then
  aws s3api create-bucket --bucket "$BUCKET" --region "$REGION" \
    --create-bucket-configuration LocationConstraint="$REGION"
  log "created bucket $BUCKET"
fi
# 퍼블릭 접근 차단
aws s3api put-public-access-block --bucket "$BUCKET" --public-access-block-configuration \
  BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
# 14일 만료 lifecycle (og 포함 균일 — 순수 함수라 재생성 저렴)
aws s3api put-bucket-lifecycle-configuration --bucket "$BUCKET" --lifecycle-configuration '{
  "Rules":[{"ID":"expire-14d","Status":"Enabled","Filter":{"Prefix":""},"Expiration":{"Days":14}}]
}'
log "isr cache bucket ready: $BUCKET (14d lifecycle)"
```

- [ ] **Step 2: EC2 role에 S3 권한 추가**

`infra/aws/00-iam-setup.sh`에서 EC2 role inline 정책(`put-role-policy --policy-name siglens-ec2-inline`) JSON에 S3 statement 추가. 기존 정책 문서에 아래 statement를 병합:
```json
{
  "Effect": "Allow",
  "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
  "Resource": "arn:aws:s3:::siglens-isr-cache/*"
}
```

> `00-iam-setup.sh`의 기존 inline 정책 정의를 읽고, 해당 statement 배열에 위 객체를 추가한다(기존 권한 유지).

- [ ] **Step 3: 문법 검증**

Run: `bash -n infra/aws/12-isr-cache.sh && bash -n infra/aws/00-iam-setup.sh && echo OK`
Expected: `OK`

- [ ] **Step 4: 커밋**

```bash
git add infra/aws/12-isr-cache.sh infra/aws/00-iam-setup.sh
git commit -m "feat(isr-cache): s3 bucket + lifecycle + ec2 iam policy"
```

---

## Task 9: 배포 파이프라인 — GIT_SHA 전달 + 옛 prefix 정리

**Files:**
- Modify: `.github/workflows/deploy.yml`
- Modify: `infra/aws/deploy.sh`

- [ ] **Step 1: deploy.yml에 GIT_SHA build-arg 전달**

`deploy.yml`의 `docker buildx build` 스텝에 `--build-arg GIT_SHA=${IMAGE_TAG}` 추가 (이미지 태그를 buildId로 재사용):
```yaml
                      --build-arg NEXT_PUBLIC_ADSENSE_ENABLED=false \
                      --build-arg GIT_SHA=${IMAGE_TAG} \
```

- [ ] **Step 2: deploy.sh에 옛 prefix 정리 추가**

`infra/aws/deploy.sh`의 instance refresh 성공 처리(`instance refresh completed successfully`) 직후, 직전 배포 prefix를 정리하는 단계를 추가:
```bash
# 직전 buildId(=직전 태그) prefix의 S3 캐시를 정리(storage 회수). lifecycle 14일이 백업.
# 현재 태그($TAG)는 보존. 정리 실패는 배포를 막지 않는다(best-effort).
PREV_TAG=$(aws ssm get-parameter --name /siglens/prev-isr-buildid --query Parameter.Value --output text 2>/dev/null || echo "")
if [ -n "$PREV_TAG" ] && [ "$PREV_TAG" != "$TAG" ]; then
  aws s3 rm "s3://${ISR_CACHE_BUCKET:-siglens-isr-cache}/siglens-isr/${PREV_TAG}/" --recursive >/dev/null 2>&1 || true
  log "purged old ISR cache prefix: $PREV_TAG"
fi
aws ssm put-parameter --name /siglens/prev-isr-buildid --value "$TAG" --type String --overwrite >/dev/null 2>&1 || true
```

> SSM 파라미터로 직전 태그를 추적한다(배포 간 상태 보존). `deploy.sh`의 변수명($TAG)이 다르면 실제 태그 변수에 맞춘다.

- [ ] **Step 3: CF 퍼지 유지 확인 (변경 금지, 보존만)**

`deploy.yml`의 기존 `Purge Cloudflare cache` 스텝(`purge_everything`)이 그대로 있는지 확인한다. ISR prefix 전환(origin 캐시 무효화)과 함께 **엣지 캐시도 비워야** 새 빌드가 즉시 서빙된다. 이 스텝은 **수정하지 말고 보존만 확인**한다(spec §4.4).

Run: `grep -n "purge_everything" .github/workflows/deploy.yml`
Expected: 기존 purge 스텝 존재 확인

- [ ] **Step 4: 문법 검증**

Run: `bash -n infra/aws/deploy.sh && echo OK`
Expected: `OK`

- [ ] **Step 5: 커밋**

```bash
git add .github/workflows/deploy.yml infra/aws/deploy.sh
git commit -m "feat(isr-cache): pass GIT_SHA buildId and purge old cache prefix on deploy"
```

---

## Task 10: 통합 테스트 (실 S3 테스트 버킷)

**Files:**
- Create: `cache-handler/__tests__/s3Store.integration.test.mjs`

**전제:** Task 8에서 S3 버킷이 생성돼 있어야 한다(실 버킷 왕복). 기본 스킵(env 가드)이라 일반 `yarn test`엔 영향 없고, 수동/CI opt-in으로만 실행한다. siglens에 localstack이 없으므로 실 버킷 + 자격증명으로 검증한다.

- [ ] **Step 1: 통합 테스트 작성**

Create `cache-handler/__tests__/s3Store.integration.test.mjs`:
```js
import { describe, it, expect } from 'vitest';

// 실 S3 왕복 통합 테스트. 기본 스킵 — 실행하려면:
//   ISR_CACHE_IT=1 ISR_CACHE_BUCKET=siglens-isr-cache GIT_SHA=it-test \
//   AWS_PROFILE=siglens yarn vitest run cache-handler/__tests__/s3Store.integration.test.mjs
// config.mjs가 모듈 로드 시 env를 읽으므로 위 env를 실행 시점에 설정해야 한다.
const RUN = process.env.ISR_CACHE_IT === '1';

describe.skipIf(!RUN)('s3Store integration (real S3)', () => {
  it('set → get 왕복이 원본과 동치다 (gzip + 키스킴 실검증)', async () => {
    const { setEntry, getEntry } = await import('../s3Store.mjs');
    const key = `/__it__/${process.env.GIT_SHA}/${Date.now()}`;
    const entry = { value: { html: 'integration' }, lastModified: 42, tags: ['it:tag'] };
    await setEntry(key, 'APP_PAGE', entry);
    expect(await getEntry(key, 'APP_PAGE')).toEqual(entry);
  });

  it('미존재 키는 null을 반환한다 (NoSuchKey 실검증)', async () => {
    const { getEntry } = await import('../s3Store.mjs');
    expect(await getEntry(`/__it__/missing/${Date.now()}`, 'APP_PAGE')).toBeNull();
  });
});
```

- [ ] **Step 2: 버킷 선행 확인**

Run: `AWS_PROFILE=siglens aws s3api head-bucket --bucket siglens-isr-cache && echo BUCKET_OK`
Expected: `BUCKET_OK` (없으면 Task 8의 `12-isr-cache.sh` 먼저 실행)

- [ ] **Step 3: 통합 테스트 실행**

Run: `ISR_CACHE_IT=1 ISR_CACHE_BUCKET=siglens-isr-cache GIT_SHA=it-test AWS_PROFILE=siglens yarn vitest run cache-handler/__tests__/s3Store.integration.test.mjs`
Expected: PASS (2 passed) — 실 S3에 gzip 왕복 + NoSuchKey 동작 확인

- [ ] **Step 4: 테스트 객체 정리**

Run: `AWS_PROFILE=siglens aws s3 rm s3://siglens-isr-cache/siglens-isr/it-test/ --recursive`
Expected: 테스트 키 삭제 (lifecycle 14일이 백업이나 명시 정리)

- [ ] **Step 5: 커밋**

```bash
git add cache-handler/__tests__/s3Store.integration.test.mjs
git commit -m "test(isr-cache): real-S3 integration test (env-gated, opt-in)"
```

---

## Task 11: 회귀 게이트 + 배포 검증

**Files:** (없음 — 검증 단계)

- [ ] **Step 1: 전체 단위 테스트 회귀**

Run: `yarn test`
Expected: 전체 PASS (cache-handler 신규 테스트 포함, 기존 회귀 없음)

- [ ] **Step 2: E2E 빌드 회귀 (cacheHandler 미등록 경로 확인)**

Run: `yarn clear:build && E2E_TEST=1 yarn build 2>&1 | tail -20`
Expected: 빌드 성공 (E2E는 ISR_CACHE_BUCKET 없어 cacheHandler 미등록 → 기존 동작)

- [ ] **Step 3: E2E 스위트**

Run: `yarn e2e`
Expected: 전체 PASS

- [ ] **Step 4: 인프라 사전 적용 (배포 전, 사용자 승인 하에)**

Run: `AWS_PROFILE=siglens bash infra/aws/12-isr-cache.sh` + `AWS_PROFILE=siglens bash infra/aws/00-iam-setup.sh`
그리고 SSM에 런타임 env 추가: `ISR_CACHE_BUCKET=siglens-isr-cache` (deploy.yml/user-data가 SSM `/siglens/`에서 env fetch).
Expected: 버킷 생성, IAM 정책 갱신, SSM 파라미터 등록

- [ ] **Step 5: 배포 + 사후 검증**

새 `v*` 태그 push → 배포. 배포 후 SSM `send-command`로 새 인스턴스 검증:
```
NEXT_PRIVATE_DEBUG_CACHE=1 컨테이너 로그에서 cacheHandler get/set 호출 + ctx.kind 값 확인
  (실제 kind가 APP_PAGE/APP_ROUTE/FETCH로 오는지 — 코드의 ctx?.kind 가정 최종 확인)
df -h /                 → 디스크 평탄화 (시간당 증가 멈춤 = 성공 기준)
aws s3 ls s3://siglens-isr-cache/siglens-isr/<태그>/pages/ → 페이지 캐시 객체 생성 확인
aws s3 ls s3://siglens-isr-cache/siglens-isr/<태그>/pages/ | grep -i opengraph
  → og image(force-static)도 cacheHandler 경유해 S3 적재되는지 확인 (spec §4.2)
```
Expected: 디스크가 더 이상 누적되지 않음(핵심 성공 기준), S3에 페이지·og 캐시 적재, news revalidateTag 동작

- [ ] **Step 6: 롤백 리허설 (선택)**

SSM에 `ISR_CACHE_DISABLED=true` 추가 + 컨테이너 재시작 → 캐시 비활성(SSR 직행) 확인 → 다시 제거.

---

## Self-Review (작성자 체크 완료)

- **Spec 커버리지**: §3 아키텍처(Task 2-5), §4.1 계약(Task 5), §4.2 키스킴/og/IMAGE(Task 4 + next.config Task 6 주석), §4.3 태그(Task 3), §4.4 무효화/배포(Task 9), §4.5 next.config(Task 6), §4.6 fail-open(Task 4/5), §4.7 Docker(Task 7), §4.8 인프라(Task 8), §4.9 킬스위치(Task 5 disabled + Task 10 Step6), §6 테스트(Task 2-5,10), §7 순서(Task 1-10) — 전부 매핑됨.
- **타입 일관성**: `getEntry(key, kind)`/`setEntry(key, kind, entry)`/`markRevalidated(tag, now)`/`maxRevalidatedAt(tags)`/`s3KeyForTest` — Task 3·4·5에서 시그니처 일치 확인.
- **IMAGE/og**: 외부화 대상 아님(IMAGE 디스크 유지) + og는 pages/ 동일 → 별도 task 불필요(키 스킴이 kind로 자동 처리, IMAGE는 핸들러에 안 옴).
- **알려진 미세 리스크**: Next 16.2 `get`/`set` ctx의 실제 `kind`/`tags` 위치는 런타임에서 `NEXT_PRIVATE_DEBUG_CACHE`로 최종 확인 필요(Task 10 Step 5) — 코드는 `ctx?.kind`/`ctx?.tags` optional 접근으로 방어.
