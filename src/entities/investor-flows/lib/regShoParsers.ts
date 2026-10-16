import type { ThresholdListingRecord, ThresholdStatusSummary } from '../model';

/**
 * Reg SHO 과열 목록(threshold securities) 파일 3형식 — 2026-10-15 실측:
 *  - Nasdaq `nasdaqthYYYYMMDD.txt`: `Symbol|Security Name|Market Category|Reg SHO Threshold Flag|Rule 3210|Filler`,
 *    마지막 줄 타임스탬프 `20261015230022`. 게시 전 날짜는 302 → HTML 안내 페이지(클라이언트가 3xx를 "없음"으로 돌리고,
 *    HTML이 와도 헤더가 없어 여기서 `unavailable`).
 *  - NYSE(NYSE·NYSE American·NYSE Arca) API: `Symbol|Security Name|Market Category|Reg SHO Threshold Flag|Filler|Filler`,
 *    마지막 줄 타임스탬프. **미래·미게시 날짜도 헤더(+푸터)만 있는 정상 응답처럼 온다** — 푸터 날짜가 요청일과 같을 때만 유효.
 *  - Cboe BZX: `Symbol|CompanyName` 두 열(플래그 열 없음), 마지막 줄 타임스탬프.
 * 공통: 열은 헤더 **이름**으로 찾고, 플래그 열이 있으면 `Y`인 행만 남긴다. 줄 끝은 CRLF·LF가 섞여 있다.
 */
export type RegShoParseResult =
    | { status: 'unavailable' }
    | { status: 'ok'; symbols: string[] };

export interface RegShoParseOptions {
    /** 요청한 거래일 `YYYY-MM-DD`. */
    requestedDate: string;
    /** 푸터 날짜가 요청일과 같아야 유효(NYSE). 푸터가 없으면 그 파일은 무효다. */
    requireFooterDate: boolean;
}

const FOOTER_TIMESTAMP = /^(\d{8})\d{6}$/;
const SYMBOL_HEADER = 'symbol';
const FLAG_HEADER = 'reg sho threshold flag';
const LISTED_FLAG = 'Y';

/** 과열 목록 텍스트 → 등재 심볼(파일 표기 그대로, 중복 제거). 헤더가 없거나(HTML) 날짜를 검증할 수 없으면 `unavailable`. */
export function parseRegShoThresholdList(
    text: string,
    options: RegShoParseOptions
): RegShoParseResult {
    const lines = text
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => line !== '');
    const [header, ...rest] = lines;
    if (header === undefined) return { status: 'unavailable' };
    const columns = header.split('|').map(name => name.trim().toLowerCase());
    const symbolColumn = columns.indexOf(SYMBOL_HEADER);
    if (symbolColumn !== 0) return { status: 'unavailable' };
    const flagColumn = columns.indexOf(FLAG_HEADER);

    const footer =
        rest.length > 0 ? FOOTER_TIMESTAMP.exec(rest.at(-1) ?? '') : null;
    const rows = footer === null ? rest : rest.slice(0, -1);
    if (options.requireFooterDate) {
        const stamp = footer?.[1];
        const footerDate =
            stamp === undefined
                ? null
                : `${stamp.slice(0, 4)}-${stamp.slice(4, 6)}-${stamp.slice(6, 8)}`;
        if (footerDate !== options.requestedDate) {
            return { status: 'unavailable' };
        }
    }

    const symbols = new Set<string>();
    for (const row of rows) {
        // 응답에 헤더가 반복되는 경우가 있다 — 데이터가 아니다.
        if (row.toLowerCase() === header.toLowerCase()) continue;
        const cells = row.split('|');
        const symbol = cells[symbolColumn]?.trim() ?? '';
        if (symbol === '') continue;
        if (
            flagColumn !== -1 &&
            cells[flagColumn]?.trim().toUpperCase() !== LISTED_FLAG
        ) {
            continue;
        }
        symbols.add(symbol);
    }
    return { status: 'ok', symbols: [...symbols] };
}

/**
 * 한 심볼의 등재 기록 + **수집된 거래일 전체**(어느 시장이든 목록을 받은 날) → 상태 요약.
 *
 * 연속 일수는 "가장 최근 수집 거래일부터 거슬러, 수집된 거래일마다 끊김 없이 등재된 날 수"다 — 휴장일·미수집일은 수집 거래일
 * 목록에 없으므로 연속을 끊지 않는다. 수집 거래일이 없으면 `asOf: null`·미등재. Reg SHO 13일 연속 규칙과 비교하는 것은
 * 분석 쪽(core)의 몫이다.
 */
export function summarizeThresholdListings(
    listings: readonly ThresholdListingRecord[],
    ingestedTradeDates: readonly string[]
): ThresholdStatusSummary {
    const dates = [...new Set(ingestedTradeDates)].sort().reverse();
    const byDate = new Map(listings.map(l => [l.tradeDate, l.markets]));
    const [asOf] = dates;
    if (asOf === undefined) {
        return {
            listed: false,
            consecutiveDays: 0,
            firstListedDate: null,
            markets: [],
            asOf: null,
        };
    }
    const streakEnd = dates.findIndex(date => !byDate.has(date));
    const streak = streakEnd === -1 ? dates : dates.slice(0, streakEnd);
    return {
        listed: streak.length > 0,
        consecutiveDays: streak.length,
        firstListedDate: streak.at(-1) ?? null,
        markets: [...(byDate.get(asOf) ?? [])].sort(),
        asOf,
    };
}
