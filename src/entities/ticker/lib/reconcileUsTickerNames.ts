import 'server-only';
import { revalidateTag } from 'next/cache';
import { fmpGet } from '@/shared/api/fmp/httpClient';
import { tryGetDatabaseClient } from '@/shared/db/client';
import { toFmpSearchSymbol } from '@/shared/lib/fmpSymbol';
import { isKrEquitySymbol } from '@/shared/config/marketProfile/registry';
import { CANONICAL_KOREAN_NAMES } from '@/shared/config/canonical-korean-names';
import {
    DrizzleAssetTranslationRepository,
    DrizzleKoreanTickerRepository,
    DrizzleProfileDescriptionTranslationRepository,
} from '../api';
import { translateCompanyNames } from './koreanTranslator';
import { invalidateKoreanTickerCache } from './koreanNameStore';
import {
    planTickerNameReconcile,
    type RenameCandidate,
    type StockListEntry,
} from './tickerNameReconcile';

export interface TickerNameReconcileCounts {
    /** stock-list 수신 행 수. */
    listed: number;
    /** stock-list에 있어 비교한 심볼 수. */
    compared: number;
    /** 실제로 이름을 갈아 쓴 심볼 수. */
    renamed: number;
    /** 쓰기 도중 실패해 다음 날로 넘어간 심볼 수. */
    failed: number;
    /** 상한 때문에 다음 날로 넘긴 후보 수. */
    deferred: number;
    /** 가드가 걸려 통째로 건너뛴 사유. 정상이면 `null`. */
    guardTrip: string | null;
}

function isStockListEntry(value: unknown): value is StockListEntry {
    if (value === null || typeof value !== 'object') return false;
    const v = value as Record<string, unknown>;
    return typeof v.symbol === 'string' && typeof v.companyName === 'string';
}

/**
 * `/stable/stock-list`(약 4만 행)를 한 번 받는다. 배열이 아니면 던진다 — 빈 목록으로
 * 흘리면 "stock-list에 없는 심볼은 건너뛴다" 규칙 때문에 조용히 아무것도 안 하고
 * 성공으로 보인다. 모양이 깨진 개별 행은 버린다.
 */
async function fetchStockList(): Promise<StockListEntry[]> {
    const raw = await fmpGet<unknown>('stock-list');
    if (!Array.isArray(raw)) {
        throw new Error('[ticker-names] stock-list response is not an array');
    }
    return raw.filter(isStockListEntry);
}

/**
 * 저장된 영문명과 FMP `stock-list`를 대조해, 티커 재할당·사명 변경으로 이름이 바뀐
 * 미국(국내 외) 종목의 한글명을 다시 번역해 갈아 쓴다. 일 1회 `kr-tickers` cron이
 * KR 동기화 뒤에 호출한다.
 *
 * 한글명이 `korean_tickers`와 `asset_translations` 두 테이블에 따로 저장되고,
 * `getAssetInfo`는 `asset_translations` 행이 있으면 FMP에 이름을 다시 묻지 않으므로
 * 심볼이 다른 회사로 넘어가도 옛 한글명이 영구히 남는다 — 이 함수가 그 굳음을 푼다.
 *
 * 처리 순서: 번역 → 회사 설명 번역 일괄 삭제 → 심볼마다 두 테이블 upsert(행이 있는
 * 쪽만) → 그 심볼의 쓰기가 성공했을 때만 `symbol:<SYM>` 태그 무효화 → 한 건이라도
 * 바뀌었으면 검색 스냅샷 무효화. 설명 삭제를 이름 쓰기보다 **먼저** 하는 이유: 이름이
 * FMP와 같아지는 순간 그 심볼은 다시 후보가 되지 않으므로, 뒤에 둔 삭제가 실패하면
 * 옛 회사 설명이 영구히 남는다(삭제는 재시도해도 무해하다). 한 심볼의 쓰기 실패는
 * 다른 심볼을 막지 않고 `failed`로 센다. 번역에 실패한 심볼은 아무것도 쓰지 않아 다음
 * 날 다시 후보가 된다. 정본(`CANONICAL_KOREAN_NAMES`) 심볼은 사람이 고른 이름이라 고치지 않고
 * 검토용 로그만 남긴다. 가드·상한은 `tickerNameReconcile.ts`.
 *
 * FMP·DB 실패는 던진다 — 호출부(cron)가 독립된 try로 로그를 남긴다.
 *
 * **EN-1 예외(`syncKrListedTickers`와 같은 지역 패턴):** 이 파일은 `lib/`에 있지만 I/O(FMP·DB)를
 * 직접 한다. 같은 cron이 앞서 부르는 `syncKrListedTickers`가 repository를 내부에서 만들고
 * 호출자(cron route) 하나만 쓰는 구조라, 이 파이프라인 단계도 같은 모양을 따른다 — 새로운
 * 주입 방식을 이 슬라이스에 하나 더 두지 않는다. 순수 판정(정규화·후보 계산·가드)은
 * `normalizeCompanyName.ts`·`tickerNameReconcile.ts`에 분리돼 있어 I/O 없이 테스트된다.
 */
export async function reconcileUsTickerNames(): Promise<TickerNameReconcileCounts> {
    const client = tryGetDatabaseClient();
    if (!client) throw new Error('[ticker-names] database unavailable');
    const koreanTickerRepo = new DrizzleKoreanTickerRepository(client.db);
    const assetTranslationRepo = new DrizzleAssetTranslationRepository(
        client.db
    );
    const descriptionRepo = new DrizzleProfileDescriptionTranslationRepository(
        client.db
    );

    const listed = await fetchStockList();
    const [koreanTickerRows, assetRows] = await Promise.all([
        koreanTickerRepo.findAllNonKr(),
        assetTranslationRepo.findAll(),
    ]);
    // 조회 키는 행이 저장한 `fmpSymbol`이다(BRK.B → BRK-B 같은 dual-class 포함). 다만
    // fmpSymbol이 심볼의 FMP 표기(`toFmpSearchSymbol`)와도 다른 행(`LAZR.MX` 같은 거래소
    // 접미사, 지수)은 canonical 심볼과 다른 자산이라 stock-list와 비교하면 엉뚱한 회사와
    // 대조되므로 뺀다.
    const eligibleAssetRows = assetRows.filter(
        row =>
            row.fmpSymbol === row.symbol ||
            row.fmpSymbol === toFmpSearchSymbol(row.symbol)
    );
    const assetTranslationRows = eligibleAssetRows.map(row => ({
        symbol: row.symbol,
        name: row.name,
        fmpKey: row.fmpSymbol,
    }));
    const assetRecordBySymbol = new Map(
        eligibleAssetRows.map(r => [r.symbol, r])
    );

    const plan = planTickerNameReconcile({
        listed,
        koreanTickerRows,
        assetTranslationRows,
        canonicalSymbols: new Set(CANONICAL_KOREAN_NAMES.keys()),
        isKrEquitySymbol,
    });

    const counts: TickerNameReconcileCounts = {
        listed: listed.length,
        compared: plan.compared,
        renamed: 0,
        failed: 0,
        deferred: plan.deferred,
        guardTrip: plan.guardTrip,
    };

    if (plan.guardTrip !== null) {
        console.error(`[ticker-names] reconcile skipped — ${plan.guardTrip}`);
        console.error(
            `[ticker-names] candidate sample: ${plan.guardSample
                .map(c => `${c.symbol} "${c.oldName}" → "${c.newName}"`)
                .join(', ')}`
        );
        return counts;
    }

    for (const c of plan.canonicalRenamed) {
        console.warn(
            `[ticker-names] canonical symbol renamed — review: ${c.symbol} ${c.oldName}→${c.newName}`
        );
    }

    if (plan.candidates.length === 0) return counts;

    const translated = await translateCompanyNames(
        plan.candidates.map(c => ({ symbol: c.symbol, name: c.newName }))
    );
    // 번역 응답에 키가 없는 심볼은 건너뛴다 — 쓰지 않으면 다음 날 다시 후보가 된다.
    const translatable = plan.candidates.filter(c => !!translated[c.symbol]);
    if (translatable.length === 0) return counts;

    const koreanTickerBySymbol = new Map(
        koreanTickerRows.map(row => [row.symbol, row])
    );

    // 회사 설명 번역을 **이름 쓰기보다 먼저** 지운다. 이름이 FMP와 같아지면 그 심볼은 다시는
    // 후보가 되지 않으므로, 이름만 쓰이고 설명 삭제가 빠지면 옛 회사 설명이 영구히 남는다.
    // 반대 순서(삭제 먼저)는 중간에 죽어도 재시도가 후보를 다시 잡고 삭제는 멱등이다.
    await descriptionRepo.deleteBySymbols(translatable.map(c => c.symbol));

    // 심볼별로 격리한다 — 한 심볼의 쓰기 실패가 나머지를 막지 않는다. 실패한 심볼은 이름이
    // 아직 안 바뀌었거나 일부만 바뀌어 다음 날 다시 후보가 된다. 태그 무효화는 그 심볼의
    // 쓰기가 모두 성공한 뒤에만 한다(옛 데이터를 새 이름으로 굳히지 않도록).
    const renameOne = async (c: RenameCandidate): Promise<boolean> => {
        const koreanName = translated[c.symbol];
        try {
            const existing = koreanTickerBySymbol.get(c.symbol);
            // exchange는 기존 값을 유지해야 하므로 행이 없으면 만들지 않는다 — 거래소를
            // 알 수 없는 행을 지어내면 검색 결과의 거래소 표기가 틀어진다.
            if (existing) {
                await koreanTickerRepo.upsertMany([
                    { ...existing, name: c.newName, koreanName },
                ]);
            }
            const assetRecord = assetRecordBySymbol.get(c.symbol);
            if (assetRecord) {
                await assetTranslationRepo.upsert({
                    ...assetRecord,
                    name: c.newName,
                    koreanName,
                });
            }
            revalidateTag(`symbol:${c.symbol.toUpperCase()}`, 'max');
            const oldKorean =
                existing?.koreanName ?? assetRecord?.koreanName ?? '-';
            console.log(
                `[ticker-names] renamed ${c.symbol}: "${c.oldName}" → "${c.newName}" (한글: ${oldKorean} → ${koreanName})`
            );
            return true;
        } catch (error) {
            console.error(`[ticker-names] rename failed ${c.symbol}:`, error);
            return false;
        }
    };

    // 순차로 처리한다(DB 연결 하나를 60개 upsert가 한꺼번에 두드리지 않게). 결과는 심볼별
    // 성공 여부 배열로 모아 개수만 센다.
    const outcomes = await translatable.reduce<Promise<readonly boolean[]>>(
        async (previous, c) => [...(await previous), await renameOne(c)],
        Promise.resolve([])
    );
    const renamed = outcomes.filter(Boolean).length;
    const failed = outcomes.length - renamed;

    // `setKoreanTickers`를 거치지 않고 repository에 직접 썼으므로 이 인스턴스의 한글 검색
    // 스냅샷을 직접 비운다.
    if (renamed > 0) await invalidateKoreanTickerCache();

    return { ...counts, renamed, failed };
}
