import type { KoreanTickerUpsertEntry } from '@/shared/lib/types';
import {
    fetchKrxListedItems,
    fetchStockPriceItems,
    type KrxListedItem,
} from './krxListedInfoClient';
import { toKoreanTickerRows } from './toKoreanTickerRows';

export interface KrTickerRowsResult {
    /** 마스터(KRX 상장종목정보) 원본 항목 — KONEX 제외·중복 병합 전. 수신량 로그용. */
    masterItems: readonly KrxListedItem[];
    /**
     * 마스터 행 + 보충 행. upsert와 상폐 판정의 입력이다. 상장주식수(`listedShares`)는 보충 소스에만 있어 마스터 행에도 같은
     * 단축코드의 보충 값을 붙인다 — 보충을 받지 못했으면 비어 있고, upsert가 저장된 값을 지우지 않는다.
     */
    rows: KoreanTickerUpsertEntry[];
    /** 마스터에 없어 주식시세 V2에서 보충한 행 수(우선주 등). */
    supplemented: number;
    /**
     * 보충 소스를 온전히 받지 못했다(오류·0건·잘림·기준일 없음). 이때 상폐 판정은 건너뛰어야
     * 한다 — `planKrTickerReconcile`의 `supplementUnavailable`로 넘긴다.
     */
    supplementUnavailable: boolean;
}

/**
 * 한국 종목 마스터 행을 만드는 **단일 관문** — 크론(`syncKrListedTickers`)과 시드 스크립트
 * (`scripts/seed-kr-listed-names.ts`)가 공유한다. 둘이 따로 조립하면 한쪽만 보충을 빠뜨린다.
 *
 * 마스터는 보통주만 준다(우선주 0건, 2026-10-15 실측). 같은 기준일의 주식시세 V2에서
 * 마스터에 없는 **단축코드**만 보충한다 — 심볼이 아니라 코드로 비교하는 이유: 시장 이전일에
 * 두 소스의 시장 구분이 어긋나면 같은 종목이 `.KS`와 `.KQ`로 두 번 들어간다.
 *
 * 보충 실패는 삼키고 `supplementUnavailable`로 알린다. 마스터만으로도 upsert는 안전하고,
 * 지우는 방향(상폐)만 막으면 된다.
 *
 * 감수한 한계: 시세 API는 "그날 시세가 있는 종목" 목록이라 거래정지된 우선주가 빠질 수
 * 있고, 그러면 상폐로 표시된다. 표시돼도 검색에서만 빠지고 페이지는 열리며, 거래가 재개돼
 * 다시 관측되면 relist된다.
 */
export async function fetchKrTickerRows(): Promise<KrTickerRowsResult> {
    const masterItems = await fetchKrxListedItems();
    const supplementItems = await fetchSupplement(masterItems[0]?.basDt);
    if (supplementItems === null) {
        return {
            masterItems,
            rows: toKoreanTickerRows(masterItems),
            supplemented: 0,
            supplementUnavailable: true,
        };
    }

    const sharesByCode = new Map(
        supplementItems.map(item => [item.shortCode, item.listedShares])
    );
    const masterRows = toKoreanTickerRows(
        masterItems.map(item => ({
            ...item,
            listedShares:
                item.listedShares ?? sharesByCode.get(item.shortCode) ?? null,
        }))
    );
    const masterCodes = new Set(masterItems.map(item => item.shortCode));
    const supplementRows = toKoreanTickerRows(
        supplementItems.filter(item => !masterCodes.has(item.shortCode))
    );
    return {
        masterItems,
        rows: [...masterRows, ...supplementRows],
        supplemented: supplementRows.length,
        supplementUnavailable: false,
    };
}

/** 보충 항목. 온전히 받지 못했으면 `null`. */
async function fetchSupplement(
    basDt: string | undefined
): Promise<readonly KrxListedItem[] | null> {
    if (basDt === undefined) return null;
    try {
        const { items, truncated } = await fetchStockPriceItems(basDt);
        if (truncated || items.length === 0) {
            console.error(
                `[kr-tickers] supplement incomplete (truncated=${truncated}, items=${items.length}) — delist will be skipped`
            );
            return null;
        }
        return items;
    } catch (error) {
        console.error(
            '[kr-tickers] supplement fetch failed — delist will be skipped',
            error
        );
        return null;
    }
}
