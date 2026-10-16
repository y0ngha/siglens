import { xmlChildText, type XmlElement } from '@/shared/lib/streamXmlElements';
import type {
    FilingPositions,
    OptionPositionRow,
    PositionRow,
    PutCall,
} from '../model';

const CUSIP_PATTERN = /^[0-9A-Z]{9}$/;

/** CUSIP 표기 정규화 — 공백 제거 + 대문자. 형식이 9자리 영숫자가 아니면 null. */
export function normalizeCusip(raw: string | null | undefined): string | null {
    const cusip = raw?.replace(/\s+/g, '').toUpperCase();
    return cusip !== undefined && CUSIP_PATTERN.test(cusip) ? cusip : null;
}

function toNonNegativeInteger(raw: string | null): number | null {
    if (raw === null) return null;
    const value = Number(raw.replace(/,/g, ''));
    return Number.isFinite(value) && value >= 0 ? Math.round(value) : null;
}

/**
 * information table의 `infoTable` 한 행 → 포지션. 다음은 null(버림):
 *  - `putCall`이 있는 행(옵션) — 주식 보유가 아니다(옵션 행은 `toOptionPositionRow`가 따로 읽는다).
 *  - `sshPrnamtType`이 `SH`가 아닌 행(`PRN`은 채권 원금).
 *  - CUSIP이 유니버스에 없는 행.
 *  - 수량·가치가 숫자가 아니거나 수량이 0인 행.
 *
 * `value`는 2023-03-31 보고 분기부터 **달러 단위**다(그 이전은 천 달러). 호출부가 그 이전
 * 분기를 거르므로 여기서는 변환하지 않는다.
 */
export function toPositionRow(
    infoTable: XmlElement,
    universe: { has(cusip: string): boolean }
): PositionRow | null {
    if (xmlChildText(infoTable, 'putCall') !== null) return null;
    const type = xmlChildText(infoTable, 'shrsOrPrnAmt', 'sshPrnamtType');
    if (type?.toUpperCase() !== 'SH') return null;
    const cusip = normalizeCusip(xmlChildText(infoTable, 'cusip'));
    if (cusip === null || !universe.has(cusip)) return null;
    const shares = toNonNegativeInteger(
        xmlChildText(infoTable, 'shrsOrPrnAmt', 'sshPrnamt')
    );
    const valueUsd = toNonNegativeInteger(xmlChildText(infoTable, 'value'));
    // 0주 행은 보유가 아니다 — 보유 기관 수에 잡히면 안 된다.
    if (shares === null || shares === 0 || valueUsd === null) return null;
    return { cusip, shares, valueUsd };
}

const PUT_CALL: Readonly<Record<string, PutCall>> = {
    PUT: 'put',
    CALL: 'call',
};

/**
 * information table의 옵션 행(`putCall`이 `Put`/`Call`) → 옵션 포지션. 주식 포지션과 같은 거름(`SH`, 유니버스 CUSIP,
 * 0주·숫자 아님 제외)을 쓴다. `sshPrnamt`는 **기초자산 주식 수**, `value`는 기초자산 환산 명목금액이다(옵션 프리미엄이 아니다).
 * `putCall`이 그 밖의 값이면 null.
 */
export function toOptionPositionRow(
    infoTable: XmlElement,
    universe: { has(cusip: string): boolean }
): OptionPositionRow | null {
    const putCall =
        PUT_CALL[xmlChildText(infoTable, 'putCall')?.toUpperCase() ?? ''];
    if (putCall === undefined) return null;
    const type = xmlChildText(infoTable, 'shrsOrPrnAmt', 'sshPrnamtType');
    if (type?.toUpperCase() !== 'SH') return null;
    const cusip = normalizeCusip(xmlChildText(infoTable, 'cusip'));
    if (cusip === null || !universe.has(cusip)) return null;
    const shares = toNonNegativeInteger(
        xmlChildText(infoTable, 'shrsOrPrnAmt', 'sshPrnamt')
    );
    const valueUsd = toNonNegativeInteger(xmlChildText(infoTable, 'value'));
    if (shares === null || shares === 0 || valueUsd === null) return null;
    return { cusip, putCall, shares, valueUsd };
}

/**
 * 같은 필러가 같은 CUSIP을 여러 행(투자재량·하위 매니저별)으로 낸 것을 한 포지션으로 합산한다 — 주식은 CUSIP별, 옵션은
 * (CUSIP, 풋/콜)별. 스트리밍 중 한 행씩 `add`하므로 메모리는 **고유 유니버스 CUSIP 수**에 비례한다(필러당 많아야 수천).
 * 누적 맵은 행마다 갱신하는 지역 상태다(수십만 행을 spread로 다시 만들면 O(N²) — CP-6 예외).
 */
export class PositionAccumulator {
    private readonly byCusip = new Map<string, PositionRow>();
    private readonly options = new Map<string, OptionPositionRow>();
    /** 행 수준 통계 — 로깅·검증용. */
    rowsSeen = 0;
    rowsKept = 0;

    constructor(private readonly universe: { has(cusip: string): boolean }) {}

    add(infoTable: XmlElement): void {
        this.rowsSeen += 1;
        const option = toOptionPositionRow(infoTable, this.universe);
        if (option !== null) {
            this.rowsKept += 1;
            const key = `${option.cusip}|${option.putCall}`;
            const existing = this.options.get(key);
            if (existing === undefined) this.options.set(key, { ...option });
            else {
                existing.shares += option.shares;
                existing.valueUsd += option.valueUsd;
            }
            return;
        }
        const row = toPositionRow(infoTable, this.universe);
        if (row === null) return;
        this.rowsKept += 1;
        const existing = this.byCusip.get(row.cusip);
        if (existing === undefined) {
            this.byCusip.set(row.cusip, { ...row });
        } else {
            existing.shares += row.shares;
            existing.valueUsd += row.valueUsd;
        }
    }

    toRows(): PositionRow[] {
        return [...this.byCusip.values()];
    }

    toOptionRows(): OptionPositionRow[] {
        return [...this.options.values()];
    }

    toPositions(): FilingPositions {
        return { rows: this.toRows(), optionRows: this.toOptionRows() };
    }
}
