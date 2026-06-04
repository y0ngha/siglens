# Cron Operations

현재 등록된 cron 작업이 없습니다. 어닝 데이터는 사용자가 종목의 뉴스 페이지에 진입할 때 on-demand 방식으로 FMP에서 fetch해 `earnings_reports` 테이블에 upsert됩니다 (`src/app/[symbol]/news/newsData.ts`의 `getEarningsReportComparison`).

## 새 Cron 추가 패턴

향후 cron을 추가할 때 따를 패턴:

1. `src/app/api/cron/<name>/route.ts` — `PATCH` (idempotent batch upsert) 핸들러. `process.env.CRON_SECRET`으로 Bearer 인증.
2. `.github/workflows/<name>-cron.yml` — `cron: '<schedule>'` UTC + `curl -X PATCH "${SIGLENS_PRODUCTION_URL}/api/cron/<name>" -H "Authorization: Bearer ${CRON_SECRET}"`.
3. 본 문서에 entry 추가.

### 필수 GitHub Secrets

GitHub repo Settings → Secrets and variables → Actions에 등록:

| Secret | 용도 |
|---|---|
| `CRON_SECRET` | Cron 라우트 핸들러 인증. **GitHub Secrets와 Vercel 환경변수 양쪽에 동일한 값 등록**. `openssl rand -hex 32`로 생성. |
| `SIGLENS_PRODUCTION_URL` | Cron 호출 대상 URL (예: `https://siglens.com`) |

### 필수 Vercel 환경변수

| 변수 | 용도 |
|---|---|
| `CRON_SECRET` | 라우트 핸들러 측 인증 검증 (위 GitHub Secret과 동일 값) |
