# Cron Operations

## `seo-prewarm` (AWS EventBridge)

`PATCH /api/cron/seo-prewarm` (spec `docs/superpowers/specs/2026-07-24-seo-recovery-bot-ssr-prewarm-design.md`)를 AWS **EventBridge classic Rule → API Destination**이 호출한다. 이 저장소 최초의 EventBridge 사용이다.

- **스케줄(UTC 고정)**: EventBridge classic Rules + API Destinations는 UTC 스케줄만 지원한다. 라우트는 ET 마감(16:00 ET) 기준 신선도로 자체 게이팅하므로 UTC 스케줄이어도 문제없다. 20:00–03:59 UTC 사이 5분 간격으로 실행되며, EST(UTC-5)/EDT(UTC-4) 양쪽에서 16:00 ET 마감을 커버한다. UTC 자정을 걸치므로 규칙을 2개로 쪼갠다:
  - `siglens-seo-prewarm-evening`: `cron(0/5 20-23 * * ? *)` (20:00–23:59 UTC)
  - `siglens-seo-prewarm-early`: `cron(0/5 0-3 * * ? *)` (00:00–03:59 UTC)
- **인증**: EventBridge Connection(`siglens-seo-prewarm`, API_KEY 인증)이 `Authorization: Bearer <CRON_SECRET>` 헤더를 자동 주입한다. `CRON_SECRET`은 `.env.example`에 필수 키로 등록돼 있고, `04-params.sh`가 SSM `/siglens/CRON_SECRET`에 이미 게시한다(check-env.sh의 OPTIONAL_KEYS에 없음 — 배포 게이트가 강제). `13-seo-prewarm.sh`는 이 값을 SSM에서 읽기만 하고 새로 만들지 않는다.
- **202/after() 설계**: 라우트는 인증·락 확인 후 즉시 `202 Accepted`를 반환하고, 실제 배치(`runPrewarmBatch`)는 `next/server`의 `after()`로 백그라운드 실행된다. API Destination의 짧은 타임아웃(~5s)이나 ALB idle timeout(60s)에 걸리지 않기 위함. 중첩 실행은 Redis 루트 락이 차단하며, 락 보유 중이면 `204`(2xx라 EventBridge가 재시도 폭풍을 일으키지 않음)를 반환한다.
- **모니터링 신호**:
  - 정상 완료: `[seo-prewarm] batch done: {counts}` (submitted/harvested/revalidated/remaining/fmpBudgetUsed)
  - 배치 전체 실패: `[seo-prewarm] batch failed: ...` → CloudWatch 알람 `siglens-seo-prewarm-batch-failed`(1시간 3회 초과 시)
  - 심볼/탭 단위 실패는 fail-open으로 격리되어 배치를 중단시키지 않는다(`[seo-prewarm] unit-error ...`, `[seo-prewarm] fmp-402 ...`). 402는 심볼별 플랜/쿼터 이슈라 정책상 알람을 걸지 않는다.
  - FMP 429(rate limit)는 `fmpRetry.ts`가 10s/15s/20s로 자동 재시도하지만, 재시도 자체를 로그로 남기지 않는다 — 안정적인 429 로그 문자열이 없어 전용 알람은 아직 없다(best-effort, `13-seo-prewarm.sh`에 TODO로 남겨둠). 429가 배치에 영향을 줄 만큼 누적되면 batch-failed 알람이 구조적 실패로 잡아낸다.
- **부트스트랩(수동, 1회)**: 첫 태그 배포 전에 다음을 순서대로 수행한다.
  1. `yarn db:migrate` — `seo_analysis_snapshots` 테이블(마이그레이션 `0027`)을 적용한다. 중복 실행 무해(이미 있으면 no-op). 이 테이블 없이 배치를 돌리면 select/upsert가 즉시 실패한다.
  2. `bash infra/aws/13-seo-prewarm.sh`를 수동 실행해 IAM 역할·Connection·API Destination·Rule 2개·타겟·알람(batch-failed + 딜리버리 부재)을 생성한다(멱등, 재실행 가능). deploy 파이프라인 어디서도 자동 호출하지 않는다.

  **이 레포 최초의 EventBridge 사용이므로, 스크립트 실행 직후 딜리버리 스파이크(수동 invoke 또는 실제 스케줄 1회 대기)로 202가 실제로 오는지 검증하기 전까지는 스케줄을 신뢰하지 말 것.** `put-targets`의 `HttpParameters` wiring은 실전 미검증 상태다. `13-seo-prewarm.sh`는 Connection이 `AUTHORIZED` 상태에 도달할 때까지 짧게 폴링(최대 12회 × 5s)한다 — 시간 내 도달하지 못해도 스크립트를 죽이지 않고 경고만 남기므로, 로그에 `WARNING: connection ... did not reach AUTHORIZED`가 보이면 수동으로 `aws events describe-connection --name siglens-seo-prewarm --query ConnectionState`를 재확인할 것.

- **딜리버리 부재 알람(OPS-1)**: 배치 내부 실패(`batch failed` 로그)는 `siglens-seo-prewarm-batch-failed`가 잡지만, EventBridge가 애초에 타겟 호출 자체를 실패하면(Connection 미인증, IAM, API Destination 오류 등) 앱 로그에는 아무 흔적도 남지 않는다. `13-seo-prewarm.sh`가 Rule별로 `AWS/Events` `FailedInvocations`(dimension `RuleName`) 알람(`siglens-seo-prewarm-evening-failed` / `-early-failed`, 5분간 1건 초과)을 함께 생성해 이 공백을 커버한다.

- **롤백 / kill-switch**: cron을 즉시 끄려면 Rule을 비활성화한다(인스턴트, 멱등, 재실행 가능):
  ```bash
  aws events disable-rule --name siglens-seo-prewarm-evening
  aws events disable-rule --name siglens-seo-prewarm-early
  ```
  다시 켤 때는 `enable-rule`로 동일하게 되돌린다. 리소스 자체(Connection/API Destination/Role)는 그대로 남으므로 재프로비저닝이 필요 없다.

- **하트비트 알람은 첫 성공 실행 후에 추가할 것**: `[seo-prewarm] batch done` 로그에 대한 metric filter + "N시간 무성공" 알람은 매력적이지만, 배포 직후(첫 스케줄 실행 전)에 만들면 정상적인 "아직 한 번도 안 돎" 상태를 즉시 알람으로 오탐한다. 딜리버리 스파이크로 첫 202/`batch done`을 확인한 뒤에 추가한다.

## Pending Follow-ups

| 테이블 | 작업 | 상태 |
|---|---|---|
| `shared_analyses` | 만료 행(`expires_at < NOW()`) 주기적 물리 삭제 | ⏳ 미구현 — 현재는 앱 레벨 `isExpired()` 필터로 읽기 시 걸러짐. 행이 누적되어 문제가 될 경우 아래 패턴에 따라 cron 라우트를 추가. |

어닝 데이터는 사용자가 종목의 뉴스 페이지에 진입할 때 on-demand 방식으로 FMP에서 fetch해 `earnings_reports` 테이블에 upsert된다(`src/app/[symbol]/news/newsData.ts`의 `getEarningsReportComparison`) — cron 아님.

## 새 Cron 추가 패턴 (AWS EventBridge)

Vercel/GitHub-Actions 시절 패턴은 폐기됐다(Vercel은 AWS로 마이그레이션 완료, GitHub Actions cron은 미사용). 새 cron을 추가할 때 따를 패턴:

1. `src/app/api/cron/<name>/route.ts` — `PATCH` (idempotent batch) 핸들러. `process.env.CRON_SECRET`으로 Bearer 인증(`timingSafeEqual` 상수시간 비교, `seo-prewarm/route.ts`의 `safeBearerCompare` 참고). 배치가 오래 걸리면 즉시 202를 반환하고 `after()`로 백그라운드 실행 + Redis 락으로 중첩 실행 차단(`seo-prewarm` 참고).
2. `infra/aws/<NN>-<name>.sh` — `13-seo-prewarm.sh`를 템플릿으로 삼아 IAM 역할(`events.amazonaws.com` trust + `events:InvokeApiDestination` inline policy) + Connection(API_KEY, `Authorization: Bearer ${CRON_SECRET}`) + API Destination(PATCH 대상 URL) + Rule(UTC cron expression, 자정 걸치면 2개로 분리) + `put-targets`로 wiring한다. 전부 idempotent(existence check 또는 `|| true`).
3. 배포 파이프라인 어디서도 자동 호출하지 않는다 — 첫 배포 전 수동 1회 실행 + 딜리버리 스파이크로 검증.
4. 본 문서에 entry 추가(스케줄·인증·모니터링 신호·부트스트랩 방법).
5. `CRON_SECRET`은 이미 SSM `/siglens/CRON_SECRET`에 게시돼 있으므로 재사용하면 되고, 새 cron 전용 시크릿이 필요하면 `.env.example`에 키를 추가해 `04-params.sh`(자동 SSM 게시) + `check-env.sh`(자동 필수 키 검증)에 편입시킨다.
