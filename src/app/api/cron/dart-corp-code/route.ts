import { DART_CRON_LEASE_NAME, handleLeasedCron } from '../leasedCron';
import { createDartCorpCodeDeps } from './createDeps';
import { runDartCorpCodeIngest } from '@/entities/investor-flows/server/ingestDartCorpCode';

/**
 * 시간 예산(SERVER.md#CC-7): 실행은 요청 하나라 수집기가 마감을 보지 않는다(`handleLeasedCron`이 요구하는 값일 뿐이다). 요청 최악
 * ≈ 3분(시도 2회 × (zip 요청 60초 + 할당량 가드의 Redis 명령 3개 × 10초) + 백오프 ≤ 2초) + 압축 해제·파싱·upsert 여유 2분
 * ≈ 5분 < 락 TTL 10분. 숫자는 `route.test.ts`가 실제 상수로 다시 계산한다.
 */
const DART_CORP_CODE_DEADLINE_MS = 60 * 1000;
const DART_CORP_CODE_LEASE_TTL_SECONDS = 10 * 60;

/**
 * DART 고유번호 맵 갱신 cron(`PATCH /api/cron/dart-corp-code`) — 주 1회. `corpCode.xml` 한 건으로 `dart_corp_code`를 갱신한다
 * (신규 상장 반영). `dart-filings`와 공유 락(`DART_CRON_LEASE_NAME`). `DART_API_KEY`가 없으면 요청 0건으로 `disabled`.
 */
export async function PATCH(request: Request): Promise<Response> {
    return handleLeasedCron(request, {
        name: 'dart-corp-code',
        leaseName: DART_CRON_LEASE_NAME,
        leaseTtlSeconds: DART_CORP_CODE_LEASE_TTL_SECONDS,
        deadlineMs: DART_CORP_CODE_DEADLINE_MS,
        run: () => runDartCorpCodeIngest(createDartCorpCodeDeps()),
    });
}
