# Cron Operations

## earnings-calendar-sync

매일 06:00 UTC (= 15:00 KST, 미국 정규장 마감 후) 어닝 캘린더 전체를 FMP에서 fetch해 DB에 upsert.

### 인프라
- **GitHub Actions Cron** (`.github/workflows/earnings-calendar-cron.yml`)
- **Schedule**: `0 6 * * *` UTC
- **HTTP Method**: `PATCH` (idempotent batch upsert)
- **Endpoint**: `/api/cron/earnings-calendar-sync`

### 필수 GitHub Secrets

GitHub repo Settings → Secrets and variables → Actions에 등록:

| Secret 이름 | 용도 | 예시 |
|---|---|---|
| `CRON_SECRET` | Cron 라우트 핸들러 인증 (Bearer 헤더). 라우트 핸들러는 `process.env.CRON_SECRET`과 일치 시에만 200 응답. **반드시 GitHub Secrets와 Vercel 환경변수 양쪽에 동일한 값으로 등록**. | `openssl rand -hex 32` 결과 |
| `SIGLENS_PRODUCTION_URL` | Cron 호출 대상 URL (production 배포 도메인). protocol 포함. | `https://siglens.com` |

### 필수 Vercel 환경변수

Vercel 프로젝트 Settings → Environment Variables에 등록 (Production 환경):

| 변수 이름 | 용도 |
|---|---|
| `CRON_SECRET` | 라우트 핸들러 측 인증 검증 (위 GitHub Secret과 동일 값) |

### 수동 트리거 (디버깅)

GitHub Actions UI에서 `Earnings Calendar Cron` workflow → `Run workflow` 버튼.

또는 curl로 직접:

```bash
curl -fsS -X PATCH \
  "https://siglens.com/api/cron/earnings-calendar-sync" \
  -H "Authorization: Bearer ${CRON_SECRET}"
```

응답: `{"inserted": <count>}` (200) 또는 `unauthorized` (401)

### 모니터링

GitHub Actions의 workflow run 페이지에서 결과 확인. 실패 시 GitHub 알림이 repo admin에게 발송 (default behavior).

### 향후 추가 Cron 작업

이 패턴을 따라 새 Cron을 추가할 때:
1. `src/app/api/cron/<name>/route.ts` — `PATCH` (또는 의미에 맞는 method)
2. `.github/workflows/<name>-cron.yml` — schedule + curl
3. 본 문서에 entry 추가
