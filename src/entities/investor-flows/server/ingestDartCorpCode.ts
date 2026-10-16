import type { DartFatalReason } from '@/shared/api/dart/dartClient';
import { unzipSingle } from '@/shared/lib/unzipSingle';
import { parseCorpCodeXml } from '../lib/dartParsers';
import { INVESTOR_FLOWS_DART_CORP_CODE_MIN_ROWS } from '../lib/investorFlowsPolicy';
import type { DartCorpCodeRow } from '../model';

/**
 * 압축을 푼 `CORPCODE.xml` 상한(바이트). 법인 ≈10만 행 × ≈250바이트 ≈ 25MB다 — 크게 여유를 둔다(넘으면 형식이 바뀐 것).
 */
export const DART_CORP_CODE_MAX_UNZIPPED_BYTES = 256 * 1024 * 1024;

export interface IngestDartCorpCodeDeps {
    dart: {
        isEnabled(): boolean;
        fetchCorpCodeZip(): Promise<Uint8Array>;
    };
    repo: {
        upsertCorpCodes(rows: readonly DartCorpCodeRow[]): Promise<void>;
    };
    /** 그 실행의 DART 요청을 멈출 오류의 이유(할당량·IP·키·점검), 아니면 null. 이 cron은 요청이 하나라 결과 상태를 가르는 데만 쓴다. */
    fatalReason: (error: unknown) => DartFatalReason | null;
    log: (message: string, detail?: unknown) => void;
}

export interface IngestDartCorpCodeResult {
    status: 'disabled' | 'complete' | 'rejected' | 'dart_refused';
    /** `dart_refused`일 때 DART가 거절한 이유. */
    refusedBy?: DartFatalReason;
    /** 반영한 상장사 행 수. */
    rows: number;
    /** 형식이 맞지 않아 버린 상장사 행 수. */
    skipped: number;
}

/**
 * DART 고유번호 맵 갱신(`dart-corp-code` cron, 주 1회) — `corpCode.xml`(zip) 한 건을 받아 상장사(종목코드 6자리) 행만
 * `dart_corp_code`에 upsert한다. 요청은 실행당 1건.
 *
 * - `DART_API_KEY`가 없으면 HTTP·DB 없이 `disabled`.
 * - 상장사 행이 `INVESTOR_FLOWS_DART_CORP_CODE_MIN_ROWS`보다 적으면 반영하지 않는다(`rejected`) — 형식 변경을 맵 축소로 오인하지 않게.
 * - 할당량·IP·키 거절은 `dart_refused`로 끝난다(로그는 클라이언트가 남긴다). 그 밖의 오류는 던져 `[dart-corp-code] run failed`가 된다.
 */
export async function runDartCorpCodeIngest(
    deps: IngestDartCorpCodeDeps
): Promise<IngestDartCorpCodeResult> {
    if (!deps.dart.isEnabled())
        return { status: 'disabled', rows: 0, skipped: 0 };
    let zip: Uint8Array;
    try {
        zip = await deps.dart.fetchCorpCodeZip();
    } catch (error) {
        const reason = deps.fatalReason(error);
        if (reason === null) throw error;
        deps.log(`[dart-corp-code] dart_refused (${reason})`);
        return {
            status: 'dart_refused',
            refusedBy: reason,
            rows: 0,
            skipped: 0,
        };
    }
    const parsed = await parseCorpCodeXml([
        unzipSingle(zip, DART_CORP_CODE_MAX_UNZIPPED_BYTES).data,
    ]);
    if (parsed.rows.length < INVESTOR_FLOWS_DART_CORP_CODE_MIN_ROWS) {
        // 메트릭 필터 접두(`infra/aws/20-dart-crons.sh`).
        deps.log(
            `[dart-corp-code] rejected — only ${parsed.rows.length} listed rows (minimum ${INVESTOR_FLOWS_DART_CORP_CODE_MIN_ROWS}); map left unchanged`
        );
        return {
            status: 'rejected',
            rows: 0,
            skipped: parsed.skipped,
        };
    }
    await deps.repo.upsertCorpCodes(parsed.rows);
    return {
        status: 'complete',
        rows: parsed.rows.length,
        skipped: parsed.skipped,
    };
}
