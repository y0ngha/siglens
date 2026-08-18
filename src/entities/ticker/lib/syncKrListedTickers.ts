import 'server-only';
import {
    fetchKrxListedItems,
    hasDataGoKrCredentials,
} from '@/shared/api/dataGoKr/krxListedInfoClient';
import { toKoreanTickerRows } from '@/shared/api/dataGoKr/toKoreanTickerRows';
import { formatCandidates, planKrTickerReconcile } from './krTickerReconcile';
import { DrizzleKoreanTickerRepository } from '../api';
import { tryGetTickerDatabaseClient } from './db';
import { invalidateKoreanTickerCache } from './koreanNameStore';

export interface KrTickerSyncCounts {
    /** 공공데이터포털 응답의 원본 항목 수 — KONEX 제외·중복 병합 전. */
    fetched: number;
    upserted: number;
    delisted: number;
    relisted: number;
    /** 가드가 걸려 상폐 처리를 건너뛴 사유. 정상이면 `null`. */
    guardTrip: string | null;
}

/**
 * 공공데이터포털 KRX 상장종목현황 → `korean_tickers` 일 1회 동기화.
 *
 * 세 가지를 한 번에 한다: 신규 상장 추가, 기존 행 갱신, 사라진 종목 상폐 표시.
 * 종전 시드(`yarn db:seed:kr-names`)는 upsert만 해서 폐지 종목이 영구 잔류했고,
 * 그 종목이 한글 검색에 뜬 뒤 클릭하면 시세가 없는 죽은 페이지로 갔다.
 *
 * 상폐 판정의 위험(부분 응답으로 멀쩡한 종목을 대량 삭제)은 `planKrTickerReconcile`의
 * 가드가 막는다 — 가드가 걸리면 upsert/relist는 그대로 하고 상폐 처리만 건너뛴다.
 *
 * 멱등하다. 같은 날 여러 번 돌아도 결과가 같다(`markDelisted`가 이미 표시된 행을
 * 건드리지 않으므로 상폐 시각도 밀리지 않는다).
 */
export async function syncKrListedTickers(): Promise<KrTickerSyncCounts> {
    if (!hasDataGoKrCredentials()) {
        throw new Error(
            '[kr-tickers] DATA_GO_KR_SERVICE_KEY missing — cannot sync'
        );
    }

    const client = tryGetTickerDatabaseClient();
    if (!client) throw new Error('[kr-tickers] database unavailable');
    const repository = new DrizzleKoreanTickerRepository(client.db);

    const items = await fetchKrxListedItems();
    const rows = toKoreanTickerRows(items);

    const existing = await repository.findAllListingStatuses();
    const plan = planKrTickerReconcile(
        rows.map(row => row.symbol),
        existing
    );

    if (plan.guardTrip !== null) {
        console.error(
            `[kr-tickers] delist skipped — ${plan.guardTrip}. Upserts still applied.`
        );
        // 후보 목록을 여기 남겨야 운영자가 CloudWatch만 보고 `--force-delist`를 줄지
        // 판단할 수 있다. 개수만 남기면 스크립트를 따로 돌려야 목록이 보인다.
        console.error(
            `[kr-tickers] delist candidates: ${formatCandidates(plan.delistCandidates)}`
        );
    }
    if (plan.delistedPopular.length > 0) {
        // POPULAR_TICKERS는 하드코딩이라 sitemap이 계속 그 URL을 싣는다 — 사람이
        // 목록에서 빼야 404가 멈춘다.
        console.error(
            `[kr-tickers] delisted popular ticker — remove from POPULAR_TICKERS: ${plan.delistedPopular.join(', ')}`
        );
    }

    // `rows`의 `name`은 공공데이터포털에 영문명이 없어 채운 한글명 placeholder다
    // (`toKoreanTickerRows` 참조). `preserveExistingName`이 없으면 이 크론이 매일 밤
    // 방문 시 `getAssetInfo`가 이미 써 둔 진짜 영문명을 placeholder로 되돌린다 — 신규
    // INSERT에는 영향 없다. 사유는 `KoreanTickerUpsertOptions` JSDoc(shared/db/types.ts)에도 있다.
    await repository.upsertMany(rows, { preserveExistingName: true });
    await repository.markRelisted(plan.relist);
    await repository.markDelisted(plan.delist);
    await invalidateKoreanTickerCache();

    return {
        // `rows`가 아니라 `items`를 센다 — KONEX 제외·중복 병합 전 원본 수신량이어야
        // 로그에서 필터가 몇 건을 걸러냈는지(fetched - upserted) 읽을 수 있다.
        fetched: items.length,
        upserted: rows.length,
        delisted: plan.delist.length,
        relisted: plan.relist.length,
        guardTrip: plan.guardTrip,
    };
}
