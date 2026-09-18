# 허브 브리핑 SSR seed 설계 (2026-09-18)

## 문제 — 프리웜은 성공하는데 페이지는 계속 비어 있다

v0.81.0(허브 AI 프리웜) 배포 후 운영 실측:

| 표면 | 프리웜 | 크롤러가 받는 HTML |
|---|---|---|
| `/news/{5개 카테고리}` | 생성/캐시신선 | ✅ 다이제스트 본문 300~385자 |
| `/market`, `/market/kr` | 생성 성공(되읽기 OK) | ❌ `peekSeed: null` |
| `/economy`, `/economy/kr` | 생성 성공(되읽기 OK) | ❌ 브리핑 없음 |

원인은 **core 캐시 키가 입력에서 파생**된다는 것이다. 브리핑 입력은 시세라 갱신될
때마다 키가 바뀐다. 실측: 크론이 14:45에 생성하고 되읽기까지 성공했는데, 15:00에
같은 경로로 `peekBriefingCache`를 다시 부르면 **miss**다(`[probe] peek hit? false`).

게다가 읽는 쪽과 쓰는 쪽이 서로 다른 스냅샷을 본다.

- 페이지: `getMarketSummaryStatic`(`unstable_cache` 1h) / `getEconomySnapshotStatic`(24h)
- 크론: `getCachedMarketSummary` / `getEconomySnapshot`(Redis, 자체 TTL)

둘이 우연히 같은 순간의 값일 때만 키가 맞는다. 뉴스 다이제스트가 유일하게 동작하는
이유는 입력이 **DB 행 목록**이라 분 단위로 안 움직이고, 정적 peek이 같은 쿼리로
입력을 다시 만들기 때문이다.

## 설계 — 프리웜이 만든 값을 안정된 키에 따로 보관한다

입력 파생 키는 SSR seed로 쓰기에 구조적으로 부적합하다(읽는 시점의 입력이 쓸 때와
다르면 영원히 miss). 그래서 **프리웜이 방금 확인한 브리핑 본문을 scope 단위의 고정
키로 Redis에 한 벌 더 저장**하고, 정적 peek이 core miss일 때 그 값을 쓴다.

```
프리웜: run* → core peek(되읽기) → 그 값을 hub-ssr-seed:{surface} 에 SET(TTL 12h)
페이지: peek*Static = core peek ?? hub-ssr-seed 읽기
```

- 생성 경로는 **그대로 최신 입력**을 쓴다. seed는 결과를 보관할 뿐이라 브리핑 품질이
  시간 지연된 스냅샷으로 떨어지지 않는다(읽는 쪽 입력에 맞춰 생성하면 그 문제가 생긴다).
- `alreadyFresh`(이미 core 캐시에 있음)일 때도 seed를 갱신한다. 그 경로에서도 값은
  이미 손에 있고, 비용은 Redis SET 한 번이다.
- 대상은 브리핑 셋(`market:us`, `market:kr`, `macro`)뿐이다. 뉴스 다이제스트는 이미
  동작하므로 건드리지 않는다.

### TTL 12h — 유일한 신선도 방어선

seed로 그려진 브리핑은 **생성 시각을 표시하지 않는다.** core의 브리핑 응답 타입에
그런 필드가 없고, seed/peek 경로의 소비자가 `generatedAt: ''`을 넘기며, `BriefingCard`는
falsy면 시각 행을 숨긴다(기존 peek 경로와 동일한 동작). 즉 나이를 알릴 수단이 없으므로
TTL이 전부다.

그래서 크론 창 사이 최대 공백(09:55→20:30 UTC ≈ 10시간 35분) 바로 위로만 잡는다.
12h면 그 공백을 덮으면서 최악 노출을 반나절로 묶는다. 더 늘리면 시각 표시도 없는 하루
지난 시황이 색인될 수 있고, 더 줄이면 정상 운영 중에도 공백에서 seed가 만료돼 페이지가
다시 빈다.

### 무효화

seed 읽기는 기존 `peek*Static`의 `unstable_cache` **안**에서 일어난다. 따라서 태그
(`market:briefing:{scope}`, `economy:briefing`)가 그대로 무효화 경로로 남고, 프리웜이
생성 후 태그를 털면 다음 렌더가 새 seed를 읽는다.

## 하지 않는 것

- **크론이 페이지와 같은 정적 스냅샷으로 생성**: 키는 맞출 수 있지만 브리핑이 최대
  1시간(거시는 24시간) 묵은 수치를 서술하게 된다. 크론 창 밖에서는 시간 경계가 굴러
  다시 miss가 되므로 공백도 못 막는다.
- **크론 스케줄 확대**: 심볼 배치까지 같이 돌아 LLM 비용이 선형으로 는다.
- **다이제스트에도 seed 추가**: 지금 동작한다. 필요해지면 그때.

## 검증

- 단위: core peek이 miss여도 seed가 있으면 정적 peek이 값을 돌려준다 / core hit이면
  seed를 읽지 않는다 / 프리웜이 생성·캐시신선 양쪽에서 seed를 쓴다.
- 배포 후: 크론 1회 수동 tick → `/market`·`/economy`를 Googlebot UA로 받아
  **브리핑 문장이 DOM(`<script>` 제외)에 있는지** 확인.
