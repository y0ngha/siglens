# 배포 안정성 감사 (5 fresh-context 에이전트)

> 현재 변경/배포에 대해 **세션 맥락을 모르는** 독립 에이전트 5개를 Opus 4.8로 띄워, 코드·배포
> 안정성·SEO·테스트 커버리지를 다각도로 감사한다. 세션 편향 없이 독립 시각을 확보하는 것이 핵심.

---

## 1. 구성 (5개 에이전트, 모두 fresh context · Opus 4.8)

| # | 에이전트 | 역할 |
|---|---|---|
| 1 | review-agent | 코드 감사 (아키텍처·도메인·컨벤션 위반) |
| 2 | 일반 agent | 배포 안정성 감사 |
| 3 | 일반 agent | "지금 배포한다고 가정" 했을 때의 배포 안정성 감사 |
| 4 | 일반 agent | `seo-audit` 스킬로 현재 SEO 감사 |
| 5 | 일반 agent | 테스트 커버리지 90%+ 및 worst/edge/integration/e2e 테스트 감사 |

**왜 fresh context인가**: 현재 세션의 맥락(무엇을 의도했는지)을 모른 채 진입해야, 세션이 당연시한
가정을 의심하고 **코드와 무관한 이슈**(예: 배포 시 빌드 필수 env 누락)까지 잡아낸다.

---

## 2. 실행

- 5개를 **병렬**로 spawn(독립이므로). 각자 fresh context로 진입.
- 모델은 Opus 4.8.
- 결과를 모아 **중복 제거 → 실제 이슈만** 선별 → 수정 PR로([PR_REVIEW_LOOP.md](./PR_REVIEW_LOOP.md)).
- 봇/에이전트 주장은 반영 전 실증([EMPIRICAL_VERIFICATION.md](./EMPIRICAL_VERIFICATION.md)).

> *사례*: 4-agent 안정성 감사가 "배포 시 특정 env가 없으면 빌드 실패"(코드 무관)를 발견 →
> predeploy 문서에 필수 env 목록으로 반영.

---

## 3. 재사용 프롬프트 템플릿

```
지금 세션의 context를 모르는채로, review-agent에게 코드 감사 / 일반 agent에게 배포 안정성 감사 / 일반 agent에게
현재 배포한다고 가정했을 떄 배포 안정성 감사 / 일반 agent에게 `seo-audit`을 이용하여 현재 SEO 감사 / 테스트 커버리지 90% 이상 및 Worst case, edge case, integration test, e2e 테스트 감사 - 총 5개의 agent를 띄우고 opus 4.8로
실행해줘.
모두 다 fresh context, 즉 지금 세션의 context를 모르는 채로 진입해야해.
```

---

## 4. 릴리스 검증과의 관계

[RELEASE_VERIFICATION.md](./RELEASE_VERIFICATION.md)가 "동작이 맞는가"(curl+브라우저 실증)를 본다면,
안정성 감사는 "배포해도 안전한가"(독립 시각의 위험 발굴)를 본다. 릴리스 전 둘을 병행하면 좋다.
