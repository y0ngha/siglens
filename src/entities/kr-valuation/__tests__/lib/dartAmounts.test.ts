import { describe, expect, it } from 'vitest';
import {
    extractShareTotals,
    extractStatementFigures,
} from '../../lib/dartAmounts';
import samsungCardAnnual from '../fixtures/samsungcard-2025-annual-cfs.json';
import samsungCardH1 from '../fixtures/samsungcard-2026-h1-cfs.json';
import samsungCardH1Shares from '../fixtures/samsungcard-2026-h1-stock-totals.json';
import samsungCardQ1 from '../fixtures/samsungcard-2026-q1-cfs.json';
import samsungCardQ3 from '../fixtures/samsungcard-2026-q3-cfs.json';
import samsungCardQ3Shares from '../fixtures/samsungcard-2026-q3-stock-totals.json';
import samsungElectronicsAnnual from '../fixtures/samsungelectronics-2025-annual-cfs.json';
import samsungElectronicsShares from '../fixtures/samsungelectronics-2026-h1-stock-totals.json';
import samsungElectronicsQ3 from '../fixtures/samsungelectronics-2026-q3-cfs.json';
import hpspAnnualOfs from '../fixtures/hpsp-2025-annual-ofs.json';
import hpspH1Ofs from '../fixtures/hpsp-2026-h1-ofs.json';
import hpspShares from '../fixtures/hpsp-2026-h1-stock-totals.json';
import ingeniaUsd from '../fixtures/ingenia-2026-q3-cfs-usd.json';

/**
 * 실 DART 응답(2026-11-22 조회)에서 PER·PBR에 쓰는 계정과 잡음 행만 줄인 픽스처다(`__tests__/fixtures`). 열 의미는 이 픽스처로 고정한다:
 * 반기·3분기의 `thstrm_amount`는 당기 3개월, `thstrm_add_amount`가 누적이다.
 */

const CFS = { fsDiv: 'CFS' as const };

describe('금액 문자열 읽기 (extractStatementFigures를 거친다)', () => {
    const figuresFor = (amount: unknown) =>
        extractStatementFigures(
            [
                {
                    sj_div: 'BS',
                    account_id: 'ifrs-full_Equity',
                    account_detail: '-',
                    thstrm_amount: amount,
                },
            ],
            { year: 2026, reportCode: '11012', fsDiv: 'CFS' }
        ).equity;

    it.each([
        ['1,234', 1234],
        ['-71,996', -71996],
        ['8904529000000', 8_904_529_000_000],
        [' 5 ', 5],
    ])('%s → %d', (input, expected) => {
        expect(figuresFor(input)).toBe(expected);
    });

    it.each([['-'], [''], ['n/a'], [undefined], [12], [null]])(
        '%s → null',
        input => {
            expect(figuresFor(input)).toBeNull();
        }
    );
});

describe('extractStatementFigures', () => {
    it('반기보고서는 누적 열(thstrm_add_amount)을 순이익으로, 전년 동기 누적(frmtrm_add_amount)을 비교값으로 읽는다', () => {
        expect(
            extractStatementFigures(samsungCardH1.list, {
                year: 2026,
                reportCode: '11012',
                ...CFS,
            })
        ).toEqual({
            year: 2026,
            reportCode: '11012',
            fsDiv: 'CFS',
            // 당기 3개월(154,202백만)이 아니라 6개월 누적이다.
            netIncomeYtd: 310_487_000_000,
            netIncomePriorYtd: 335_640_000_000,
            equity: 8_904_529_000_000,
        });
    });

    it('1분기보고서는 3개월 = 누적이라 thstrm_amount를 쓰고 전년 동기는 frmtrm_add_amount다', () => {
        const figures = extractStatementFigures(samsungCardQ1.list, {
            year: 2026,
            reportCode: '11013',
            ...CFS,
        });
        expect(figures.netIncomeYtd).toBe(156_284_000_000);
        expect(figures.netIncomePriorYtd).toBe(184_440_000_000);
        expect(figures.equity).toBe(8_753_945_000_000);
    });

    it('3분기보고서는 9개월 누적을 읽는다', () => {
        const figures = extractStatementFigures(samsungCardQ3.list, {
            year: 2026,
            reportCode: '11014',
            ...CFS,
        });
        expect(figures.netIncomeYtd).toBe(450_303_000_000);
        expect(figures.netIncomePriorYtd).toBe(497_329_000_000);
    });

    it('사업보고서는 당기(thstrm_amount) 한 해 순이익과 전기(frmtrm_amount)를 읽는다', () => {
        const figures = extractStatementFigures(samsungCardAnnual.list, {
            year: 2025,
            reportCode: '11011',
            ...CFS,
        });
        expect(figures.netIncomeYtd).toBe(645_923_000_000);
        expect(figures.netIncomePriorYtd).toBe(664_593_000_000);
        expect(figures.equity).toBe(8_863_284_000_000);
    });

    it('비지배지분이 있는 연결 재무제표는 합계(ProfitLoss·Equity)가 아니라 지배주주 계정을 쓴다', () => {
        const figures = extractStatementFigures(samsungElectronicsQ3.list, {
            year: 2026,
            reportCode: '11014',
            ...CFS,
        });
        // 합계(193,985,871)·(614,111,577)이 아니라 지배주주 몫(193,578,792)·(605,443,984)이다.
        expect(figures.netIncomeYtd).toBe(193_578_792_000_000);
        expect(figures.netIncomePriorYtd).toBe(24_968_902_000_000);
        expect(figures.equity).toBe(605_443_984_000_000);
    });

    it('지배주주 계정이 없고 비지배지분이 실제로 있으면 합계로 갈음하지 않는다(null)', () => {
        const withoutOwnersRows = samsungElectronicsQ3.list.filter(
            row =>
                row.account_id !==
                    'ifrs-full_ProfitLossAttributableToOwnersOfParent' &&
                row.account_id !==
                    'ifrs-full_EquityAttributableToOwnersOfParent'
        );
        const figures = extractStatementFigures(withoutOwnersRows, {
            year: 2026,
            reportCode: '11014',
            ...CFS,
        });
        expect(figures.netIncomeYtd).toBeNull();
        expect(figures.netIncomePriorYtd).toBeNull();
        expect(figures.equity).toBeNull();
    });

    it('비지배지분이 없는 회사는 지배주주 순이익 행이 없어도 합계(ProfitLoss)로 갈음한다', () => {
        // 삼성카드는 `…AttributableToOwnersOfParent` 순이익 행이 없다(비지배지분 없음).
        expect(
            samsungCardH1.list.some(
                row =>
                    row.account_id ===
                    'ifrs-full_ProfitLossAttributableToOwnersOfParent'
            )
        ).toBe(false);
        const figures = extractStatementFigures(samsungCardH1.list, {
            year: 2026,
            reportCode: '11012',
            ...CFS,
        });
        expect(figures.netIncomeYtd).toBe(310_487_000_000);
    });

    it('별도 재무제표(OFS)는 합계 계정이 곧 답이다', () => {
        const figures = extractStatementFigures(hpspH1Ofs.list, {
            year: 2026,
            reportCode: '11012',
            fsDiv: 'OFS',
        });
        expect(figures.fsDiv).toBe('OFS');
        expect(figures.netIncomeYtd).toBe(48_968_939_225);
        expect(figures.netIncomePriorYtd).toBe(35_904_573_401);
        expect(figures.equity).toBe(313_461_715_028);
        expect(
            extractStatementFigures(hpspAnnualOfs.list, {
                year: 2025,
                reportCode: '11011',
                fsDiv: 'OFS',
            }).netIncomeYtd
        ).toBe(72_662_225_546);
    });

    it('자본변동표(SCE)·현금흐름표(CF)에 있는 같은 계정 id는 읽지 않는다', () => {
        // 손익계산서 행을 지우면 SCE·CF의 ProfitLoss 행만 남는다 — 그 값으로 대신하지 않고 null이다.
        const onlyOtherStatements = samsungCardH1.list.filter(
            row =>
                !(
                    row.account_id === 'ifrs-full_ProfitLoss' &&
                    row.sj_div === 'CIS'
                )
        );
        expect(
            onlyOtherStatements.some(
                row =>
                    row.account_id === 'ifrs-full_ProfitLoss' &&
                    ['SCE', 'CF'].includes(row.sj_div)
            )
        ).toBe(true);
        const figures = extractStatementFigures(onlyOtherStatements, {
            year: 2026,
            reportCode: '11012',
            ...CFS,
        });
        expect(figures.netIncomeYtd).toBeNull();
        expect(figures.equity).toBe(8_904_529_000_000);
    });

    it('누적 열이 비어 있는 반기 행은 3개월 값을 누적으로 오인하지 않고 null이다', () => {
        const noAddColumn = samsungCardH1.list.map(row =>
            row.account_id === 'ifrs-full_ProfitLoss' && row.sj_div === 'CIS'
                ? { ...row, thstrm_add_amount: '' }
                : row
        );
        expect(
            extractStatementFigures(noAddColumn, {
                year: 2026,
                reportCode: '11012',
                ...CFS,
            }).netIncomeYtd
        ).toBeNull();
    });

    it('원화가 아닌 통화로 공시한 법인은 모든 값이 null이다(주가와 단위가 다르다)', () => {
        expect(
            new Set(ingeniaUsd.list.map(row => row.currency)).has('USD')
        ).toBe(true);
        expect(
            extractStatementFigures(ingeniaUsd.list, {
                year: 2026,
                reportCode: '11014',
                ...CFS,
            })
        ).toEqual({
            year: 2026,
            reportCode: '11014',
            fsDiv: 'CFS',
            netIncomeYtd: null,
            netIncomePriorYtd: null,
            equity: null,
        });
    });

    it('2025 사업보고서(삼성전자)는 지배주주 순이익 한 해 값을 읽는다', () => {
        expect(
            extractStatementFigures(samsungElectronicsAnnual.list, {
                year: 2025,
                reportCode: '11011',
                ...CFS,
            }).netIncomeYtd
        ).toBe(44_260_956_000_000);
    });
});

describe('extractShareTotals', () => {
    it('합계 줄의 발행주식 총수·자기주식·유통주식수를 읽는다(삼성카드 반기)', () => {
        expect(extractShareTotals(samsungCardH1Shares.list)).toEqual({
            issued: 115_858_891,
            treasury: 9_148_196,
            outstanding: 106_710_695,
            settledOn: '2026-06-30',
        });
    });

    it('우선주가 있으면 보통주와 우선주를 합친 합계를 쓴다(삼성전자)', () => {
        expect(extractShareTotals(samsungElectronicsShares.list)).toEqual({
            issued: 6_648_649_811,
            treasury: 82_086_705,
            outstanding: 6_566_563_106,
            settledOn: '2026-06-30',
        });
    });

    it('합계 줄이 없으면 보통주·우선주 줄을 더한다', () => {
        const withoutTotal = samsungElectronicsShares.list.filter(
            row => row.se !== '합계'
        );
        expect(extractShareTotals(withoutTotal)).toMatchObject({
            issued: 5_846_278_608 + 802_371_203,
            treasury: 82_086_705,
            outstanding: 5_764_191_903 + 802_371_203,
        });
    });

    it('자기주식이 `-`인 회사는 0으로 읽고 유통주식수는 발행주식과 같다', () => {
        const noTreasury = hpspShares.list.map(row => ({
            ...row,
            tesstk_co: '-',
            distb_stock_co: '-',
        }));
        expect(extractShareTotals(noTreasury)).toMatchObject({
            issued: 82_300_000,
            treasury: 0,
            outstanding: 82_300_000,
        });
    });

    it('분기보고서처럼 모든 줄이 `-`이면 null이다(표를 싣지 않는다)', () => {
        expect(extractShareTotals(samsungCardQ3Shares.list)).toBeNull();
    });

    it('줄이 하나도 없으면 null이다', () => {
        expect(extractShareTotals([])).toBeNull();
    });
});
