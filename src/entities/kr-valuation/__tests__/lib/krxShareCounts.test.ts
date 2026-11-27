import { describe, expect, it } from 'vitest';
import type { KrxListedItem } from '@/shared/api/dataGoKr/krxListedInfoClient';
import { defined } from '@/shared/test-utils/defined';
import { toKrxShareCounts } from '../../lib/krxShareCounts';
import alteogenRows from '../fixtures/alteogen-krx-stock-price-v2-rows.json';
import hanwhaRows from '../fixtures/hanwhasolutions-krx-stock-price-v2-rows.json';

interface RawRow {
    basDt: string;
    srtnCd: string;
    itmsNm: string;
    mrktCtg: string;
    isinCd: string;
    lstgStCnt: string;
}

/** 실제 주식시세 V2 행을 클라이언트가 만드는 `KrxListedItem` 모양으로 옮긴다. */
const asItems = (rows: readonly RawRow[]): KrxListedItem[] =>
    rows.map(row => ({
        shortCode: row.srtnCd,
        koreanName: row.itmsNm,
        market: row.mrktCtg as KrxListedItem['market'],
        isin: row.isinCd,
        corpName: row.itmsNm,
        basDt: row.basDt,
        listedShares: Number(row.lstgStCnt),
    }));

describe('toKrxShareCounts', () => {
    it('보통주와 같은 이름으로 시작하는 우선주를 더한다(한화솔루션 + 한화솔루션우)', () => {
        expect(
            toKrxShareCounts(
                asItems(hanwhaRows).filter(r => r.basDt === '20260930')
            )
        ).toEqual({
            asOf: '2026-09-30',
            common: 224_892_536,
            preferred: 2_544_616,
        });
    });

    it('날짜가 섞인 목록이면 가장 늦은 날 행만 쓴다', () => {
        expect(toKrxShareCounts(asItems(hanwhaRows))?.asOf).toBe('2026-09-30');
        expect(
            toKrxShareCounts(
                asItems(hanwhaRows).filter(r => r.basDt === '20260630')
            )
        ).toEqual({
            asOf: '2026-06-30',
            common: 171_892_536,
            preferred: 2_575_349,
        });
    });

    it('우선주가 상장되지 않은 회사는 preferred가 null이다(알테오젠)', () => {
        expect(
            toKrxShareCounts(
                asItems(alteogenRows).filter(r => r.basDt === '20260630')
            )
        ).toEqual({ asOf: '2026-06-30', common: 53_586_343, preferred: null });
    });

    it('이름이 보통주 이름으로 시작하지 않는 같은 접두사 종목은 우선주로 보지 않는다', () => {
        const common = defined(asItems(alteogenRows)[0]);
        const other = {
            ...common,
            shortCode: '196175',
            koreanName: '다른회사우',
            listedShares: 7,
        };
        expect(toKrxShareCounts([common, other])?.preferred).toBeNull();
    });

    it('보통주 상장주식수가 없거나 목록이 비면 null이다', () => {
        const common = defined(asItems(alteogenRows)[0]);
        expect(
            toKrxShareCounts([{ ...common, listedShares: null }])
        ).toBeNull();
        expect(toKrxShareCounts([])).toBeNull();
    });
});
