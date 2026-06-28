# ISR 캐시 핸들러 운영 런북

> S3 외부화 캐시 핸들러(Next.js `cacheHandler`)의 설치·운영·장애대응 가이드.
> 설계 근거: `cache-handler/` 소스 + `infra/aws/12-isr-cache.sh`.
> 관련: [`ISR_REVALIDATE.md`](./ISR_REVALIDATE.md) (revalidate 정책), [`CDN_CACHING.md`](./CDN_CACHING.md) (CF 엣지 캐싱).

## 0. 개요

ISR 캐시 엔트리를 인스턴스 로컬 디스크 대신 **S3에 저장**한다.
배포마다 격리 prefix(`siglens-isr/{GIT_SHA}/`)를 쓰므로 롤아웃 중 구버전 캐시와 충돌하지 않는다.

**키 스킴:**

```
siglens-isr/{GIT_SHA}/{pages|fetch}/{encoded-or-sha256-key}.cache
```

- `pages/` — Next.js 라우트 HTML/RSC 캐시 엔트리.
- `fetch/` — `unstable_cache` / route-segment fetch 캐시 엔트리.
- 키가 900바이트를 초과하면 sha256으로 대체(S3 1 024 바이트 한계 대응).

S3 get/set 실패는 **fail-open**: 오류를 `console.error('[isr-cache] s3 get/set failed', ...)` 로만 기록하고
렌더가 SSR 폴백으로 이어진다. 캐시 계층이 깨져도 서비스는 살아있으나 S3 비용(ISR Write) 없는
SSR 폭주 + 디스크풀 회귀 위험이 있다 — `siglens-isr-cache-failures` 알람(§4)이 이를 잡는다.

## 1. 킬 스위치 (`ISR_CACHE_DISABLED`) ⚠️ 즉시 적용 아님

`ISR_CACHE_DISABLED=true` 환경변수가 설정되면 `cache-handler/config.mjs`가 `disabled: true`로
읽히고, `cache-handler/index.mjs`가 모든 get/set를 no-op으로 처리해 순수 SSR로 강등된다.

**단, env-file은 부팅 시 `ExecStartPre`(`siglens-fetch-env.sh`)에서만 읽히므로 SSM 주입 후
컨테이너 재시작이 필요하다.** 실시간 토글이 아님.

**절차 (단계별):**

```bash
# 1. SSM 파라미터 주입 (한 줄)
aws ssm put-parameter \
  --name /siglens/ISR_CACHE_DISABLED \
  --value "true" \
  --type String \
  --overwrite \
  --region ap-northeast-2

# 2. 적용 확인 (주입 직후)
aws ssm get-parameter --name /siglens/ISR_CACHE_DISABLED --region ap-northeast-2 --query Parameter.Value --output text

# 3. ASG instance refresh 시작 — 신규 인스턴스가 SSM 재fetch 후 기동됨
aws autoscaling start-instance-refresh \
  --auto-scaling-group-name siglens-asg \
  --preferences MinHealthyPercentage=100 \
  --region ap-northeast-2

# 4. refresh 완료 대기
aws autoscaling describe-instance-refreshes \
  --auto-scaling-group-name siglens-asg \
  --region ap-northeast-2 \
  --query 'InstanceRefreshes[0].Status'
# "Successful" 이 될 때까지 반복

# 5. 킬 스위치 확인 (앱 로그에서)
# CloudWatch Logs Insights → /siglens/app 에서 "[isr-cache]" 로그가 사라지는지 확인.
# ⚠️ instance refresh 완료 직후 0건은 아직 요청이 없는 것일 수 있음.
#    refresh 완료 후 5분간 새 "[isr-cache]" 에러 로그가 나타나지 않으면 비활성 확인 완료.
```

**원복 (재활성화):**

```bash
# 파라미터 삭제(기본값 false) 또는 "false"로 덮어쓰기
aws ssm delete-parameter --name /siglens/ISR_CACHE_DISABLED --region ap-northeast-2
# 이후 동일하게 instance refresh 진행
```

## 2. 로그 조회 (CloudWatch Logs Insights)

컨테이너 stdout/stderr는 awslogs 드라이버 → `/siglens/app` 로그 그룹(14일 보존).

**`[isr-cache]` 필터 (최근 1시간):**

```
fields @timestamp, @message
| filter @message like /\[isr-cache\]/
| sort @timestamp desc
| limit 200
```

**get/set 실패만:**

```
fields @timestamp, @message
| filter @message like /\[isr-cache\] s3 (get|set) failed/
| sort @timestamp desc
| limit 200
```

**시간별 실패 카운트 추이:**

```
filter @message like /\[isr-cache\] s3 (get|set) failed/
| stats count() as failures by bin(5m)
| sort @timestamp asc
```

AWS CLI에서 직접 조회:

```bash
# 최근 5분
aws logs filter-log-events \
  --log-group-name /siglens/app \
  --filter-pattern '"[isr-cache]"' \
  --start-time $(($(date +%s) - 300))000 \
  --region ap-northeast-2 \
  --query 'events[].message' --output text
```

## 3. 수동 캐시 정리

**특정 배포 prefix 정리 (롤백 후 구버전 캐시 삭제 등):**

```bash
TAG=<GIT_SHA>
aws s3 rm s3://siglens-isr-cache/siglens-isr/${TAG}/ --recursive --region ap-northeast-2
```

**전체 cold 강제 (버킷 비우기 — 모든 캐시 삭제, 다음 요청부터 SSR 폴백 → 재생성):**

```bash
# ⚠️ 트래픽 급증 주의 — 비우면 다음 N 분간 모든 ISR 라우트가 SSR로 처리됨
aws s3 rm s3://siglens-isr-cache/ --recursive --region ap-northeast-2
```

**새 배포로 자연 무효화:**

`GIT_SHA`가 바뀌면 신규 prefix가 사용되고 구버전 캐시는 접근되지 않는다.
14일 lifecycle이 스스로 정리한다 — 수동 삭제 불필요.

## 4. 모니터링

### `siglens-isr-cache-failures` 알람

- **네임스페이스**: `Siglens/ISRCache` / 메트릭: `IsrCacheFailures`
- **메트릭 필터**: `/siglens/app`에서 `"[isr-cache]"` 패턴을 카운트.
- **임계값**: 5분(period=300) 내 Sum > 5 → ALARM (SNS `siglens-alerts` 알림).
- `defaultValue=0` 설정으로 로그 공백 기간에도 `notBreaching` 상태 유지.
- **해석**: 일시적 S3 hiccup은 낮은 빈도로 정상. 알람 발화 = 5분간 5건 초과 = 구조적 실패(IAM 퍼미션 박탈, 버킷 삭제, IMDS 차단 등). 즉시 조사 필요.

### `siglens-disk-high` — 캐시 외부화 회귀 카나리

- 기존 디스크 모니터링 알람(85% 임계값 불변).
- **S3 외부화 이후 디스크 사용량이 다시 상승하면** `[isr-cache] s3 set failed` 가 대량으로 찍히면서
  캐시가 로컬에 쌓이거나(핸들러 폴백) 로그가 디스크를 소비한다는 신호.
  `siglens-isr-cache-failures`와 함께 상관 분석한다.

### (권장) S3 버킷 크기 알람

현재 미설정. 정기적으로 아래로 확인하거나 추후 알람 추가를 권장한다:

```bash
# 버킷 전체 용량 (콘솔 S3 Storage Lens 또는 CLI)
aws s3 ls s3://siglens-isr-cache/ --recursive --summarize | tail -2
```

## 5. 알려진 한계 / 백로그 (운영검토 발견)

### 재태그(re-tag) stale 위험

`buildId`는 `GIT_SHA` 환경변수 값 — 배포 시 이미지 태그이자 S3 prefix다.
**동일 SHA에 새 태그를 붙여 재배포하면 구버전과 prefix가 같아 오염된 캐시가 재사용된다.**
→ 재태그 금지. 패치는 반드시 새 커밋(새 SHA) + 새 이미지 빌드.

### 롤백 시 SSM `prev-isr-buildid` 드리프트

`deploy.sh`는 롤백용 `prev-isr-buildid` SSM 파라미터를 유지하지 않는다.
롤백 시 수동으로 이전 SHA의 캐시 prefix가 유효한지 확인해야 한다(14일 내이면 존재).

### 멀티인스턴스 태그 전파

S3 마커 기반 `buildId` 전파는 현재 ASG 인스턴스 수가 1개일 때 단순하다.
ASG 스케일아웃(인스턴스 추가) 시 신규 인스턴스는 이미지 내 `GIT_SHA`를 그대로 읽으므로
별도 전파 없이 동일 prefix를 쓴다 — 현재 구조상 문제 없음.
향후 Blue/Green 배포나 가중치 라우팅 도입 시 `DynamoDB` buildId 레지스트리(spec §8)로 확장 검토.

### IAM 파일 버킷명 동기화

버킷명(`siglens-isr-cache`)은 다음 5곳에서 동기화되어야 한다:
- `infra/aws/12-isr-cache.sh` (BUCKET 기본값)
- `infra/aws/deploy.sh` (구버전 캐시 purge 경로)
- `.github/workflows/deploy.yml` (`--build-arg ISR_CACHE_BUCKET=…`)
- `infra/aws/iam/ec2-role-policy.json` (IsrCacheS3 statement `Resource` ARN)
- `infra/aws/iam/ci-deploy-policy.json` (IsrCachePurge statement `Resource` ARN)

버킷명 변경 시 5곳 모두 수정.

### 2주 후 실비용 실측

S3 외부화가 ISR Write 비용을 실제로 얼마나 줄였는지 AWS Cost Explorer(서비스 = S3, 기간 비교)로
확인한다. ISR Write 유닛 절감량 vs S3 요청·스토리지 비용 증분의 순편익이 포인트.
