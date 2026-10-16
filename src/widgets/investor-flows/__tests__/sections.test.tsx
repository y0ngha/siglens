// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ScorecardCard } from '../sections/ScorecardCard';
import { InstitutionalSection } from '../sections/InstitutionalSection';
import { ShortSection } from '../sections/ShortSection';
import { ShortInterestBlock } from '../sections/ShortInterestBlock';
import { buildShortInterestView } from '../utils/short';
import { InsiderSection } from '../sections/InsiderSection';
import { LargeHoldersSection } from '../sections/LargeHoldersSection';
import { AsOfNotice } from '../sections/AsOfNotice';
import { InvestorFlowsContent } from '../InvestorFlowsContent';
import { InvestorFlowsEmpty } from '../InvestorFlowsEmpty';
import type { InvestorFlowsSnapshot } from '@y0ngha/siglens-core';
import type { CollectingArms } from '@/entities/investor-flows/lib/investorFlowsReadiness';
import type { InvestorFlowsPipelineReadiness } from '@/entities/investor-flows/model';
import {
    evaluate,
    makeEmptySnapshot,
    makeLargeHolder,
    makeSnapshot,
    makeTransaction,
} from './fixtures/flowsFixtures';

const READY_READINESS: InvestorFlowsPipelineReadiness = {
    institutional: 'ready',
    short: 'ready',
    failsToDeliver: 'ready',
    filings: 'ready',
    thresholdList: 'ready',
};

const NOT_COLLECTING: CollectingArms = {
    institutional: false,
    short: false,
    failsToDeliver: false,
    proposedSales: false,
    offerings: false,
    thresholdList: false,
};

function institutionalProps(snapshot: InvestorFlowsSnapshot) {
    return {
        institutional: snapshot.institutional,
        metrics: evaluate(snapshot).institutional.metrics,
    };
}

function shortProps(snapshot: InvestorFlowsSnapshot) {
    return {
        snapshot,
        scorecard: evaluate(snapshot),
        finraEnabled: true,
        regShoEnabled: true,
        collecting: NOT_COLLECTING,
    };
}

function insiderProps(snapshot: InvestorFlowsSnapshot) {
    return {
        transactions: snapshot.insider.transactions,
        proposedSales: snapshot.proposedSales,
        proposedSalesCollecting: false,
        scorecard: evaluate(snapshot),
    };
}

function asOfProps(snapshot: InvestorFlowsSnapshot, showFinra: boolean) {
    return {
        freshness: evaluate(snapshot, showFinra).freshness,
        snapshotAsOf: snapshot.asOf,
        showFinra,
        regShoEnabled: false,
        thresholdAsOf: null,
        collecting: NOT_COLLECTING,
    };
}

vi.mock('@/shared/ui/InfoTooltip', () => ({
    InfoTooltip: ({ children }: { children: React.ReactNode }) => (
        <span data-testid="info-tooltip">{children}</span>
    ),
}));

describe('ScorecardCard', () => {
    it('종합 점수·라벨(기호+글자)과 5개 축을 그린다', () => {
        const snapshot = makeSnapshot();
        render(<ScorecardCard scorecard={evaluate(snapshot)} />);
        expect(
            screen.getByRole('heading', { level: 2, name: /수급 점수/ })
        ).toBeInTheDocument();
        for (const axis of [
            '기관',
            '내부자',
            '대량보유(5%)',
            '공매도',
            '증자·희석',
        ]) {
            expect(
                screen.getByRole('heading', {
                    level: 3,
                    name: new RegExp(axis.replace(/[()]/g, '\\$&')),
                })
            ).toBeInTheDocument();
        }
    });

    it('FINRA가 꺼져도 공매도 축 카드는 남고 "데이터 부족"이라고 말한다(빈 카드로 숨기지 않는다)', () => {
        const snapshot = makeSnapshot({
            shortInterest: null,
            shortVolume: null,
        });
        render(<ScorecardCard scorecard={evaluate(snapshot, false)} />);
        const card = screen
            .getByRole('heading', { level: 3, name: /공매도/ })
            .closest('li');
        expect(card).not.toBeNull();
        expect(
            within(card as HTMLElement).getByText('데이터 부족')
        ).toBeInTheDocument();
    });

    it('데이터가 없는 축은 "데이터 부족"을 말하고 점수 숫자를 내지 않는다', () => {
        render(<ScorecardCard scorecard={evaluate(makeEmptySnapshot())} />);
        expect(screen.getAllByText('데이터 부족').length).toBeGreaterThan(0);
        expect(
            screen.getByText(/종합 점수를 계산하지 못했어요/)
        ).toBeInTheDocument();
        expect(screen.queryByText(/\d점$/)).toBeNull();
    });
});

describe('InstitutionalSection', () => {
    it('IN/OUT 막대 라벨과 부호를 글자로 낸다', () => {
        render(
            <InstitutionalSection {...institutionalProps(makeSnapshot())} />
        );
        const chart = screen.getByRole('list', { name: /분기별 기관 순매수/ });
        expect(within(chart).getAllByText('IN').length).toBe(3);
        expect(within(chart).getAllByText('OUT').length).toBe(1);
        expect(within(chart).getByText('부분 집계')).toBeInTheDocument();
        expect(within(chart).getByText(/^\+1\.4억$/)).toBeInTheDocument();
        expect(
            within(chart).getByText(/^-4\.8천만$|^-4800만$/)
        ).toBeInTheDocument();
    });

    it('4분할 카드에 직전 분기 대비 증감을 화살표·글자로 낸다', () => {
        render(
            <InstitutionalSection {...institutionalProps(makeSnapshot())} />
        );
        expect(screen.getByText('신규 진입')).toBeInTheDocument();
        expect(screen.getByText('310곳')).toBeInTheDocument();
        expect(
            screen.getByText('직전 분기보다 70곳 많아요')
        ).toBeInTheDocument();
        expect(
            screen.getByText('직전 분기보다 320곳 적어요')
        ).toBeInTheDocument();
    });

    it('진행 중 분기는 부분 집계 안내로 따로 알린다', () => {
        render(
            <InstitutionalSection {...institutionalProps(makeSnapshot())} />
        );
        expect(screen.getByTestId('flows-partial-quarter')).toHaveTextContent(
            '2026-09-30'
        );
    });

    it('데이터가 전혀 없으면 "데이터 없음"을 명시한다', () => {
        render(
            <InstitutionalSection
                {...institutionalProps(makeEmptySnapshot())}
            />
        );
        expect(screen.getByText(/데이터 없음/)).toBeInTheDocument();
    });

    it('필터로 신규·청산 기관만 볼 수 있다', async () => {
        const user = userEvent.setup();
        render(
            <InstitutionalSection {...institutionalProps(makeSnapshot())} />
        );
        await user.click(screen.getByRole('button', { name: '완전 청산 1' }));
        expect(
            screen.getAllByText('Fixture Hedge Fund LP').length
        ).toBeGreaterThan(0);
        expect(screen.queryByText('Fixture Index Advisors')).toBeNull();
        await user.click(screen.getByRole('button', { name: '신규 진입 1' }));
        expect(
            screen.getAllByText('Fixture Global Partners').length
        ).toBeGreaterThan(0);
        expect(
            screen.getByRole('button', { name: '신규 진입 1' })
        ).toHaveAttribute('aria-pressed', 'true');
    });

    it('상태 배지는 글자로 구분한다(신규/증가/감소/청산)', () => {
        render(
            <InstitutionalSection {...institutionalProps(makeSnapshot())} />
        );
        for (const label of ['신규', '증가', '감소', '청산']) {
            expect(screen.getAllByText(label).length).toBeGreaterThan(0);
        }
    });
});

describe('ShortSection', () => {
    const snapshot = makeSnapshot();
    const props = shortProps(snapshot);

    it('잔고·유통주식 대비·상환일수와 증감 배지를 그린다', () => {
        render(<ShortSection {...props} />);
        expect(screen.getByText('공매도 잔고(주)')).toBeInTheDocument();
        expect(screen.getByText('직전 결제일 대비')).toBeInTheDocument();
        expect(screen.getByText('증가')).toBeInTheDocument();
    });

    it('장외 공매도 비중 급증 표식과 TRF 각주를 낸다', () => {
        render(<ShortSection {...props} />);
        expect(screen.getByText('평소보다 급증')).toBeInTheDocument();
        expect(
            screen.getByText(/장외\(TRF\) 보고분 기준이에요/)
        ).toBeInTheDocument();
    });

    it('squeezeRisk가 아니면 숏스퀴즈 배지를 내지 않는다', () => {
        render(<ShortSection {...props} />);
        expect(screen.queryByText('숏스퀴즈 위험')).toBeNull();
    });

    it('squeezeRisk면 숏스퀴즈 경고를 낸다', () => {
        const squeeze = makeSnapshot({
            shortInterest: [0, 1, 2, 3, 4, 5].map(i => ({
                settlementDate: `2026-0${4 + i}-15`,
                shortQty: 2_100_000_000 + 160_000_000 * i,
                avgDailyVolume: 380_000_000,
                daysToCover: 5.5 + i * 0.3,
            })),
        });
        render(<ShortSection {...shortProps(squeeze)} />);
        expect(screen.getByText(/숏스퀴즈 위험/)).toBeInTheDocument();
        // role="note"에는 접근 가능한 이름이 있다(AX-2).
        expect(
            screen.getByRole('note', { name: /숏스퀴즈 위험/ })
        ).toBeInTheDocument();
    });

    it('유통주식 대비 %와 변화율은 점수표(core) 값을 그대로 쓴다', () => {
        const card = evaluate(snapshot);
        render(<ShortSection {...props} />);
        expect(card.short.metrics.shortInterestPctFloat).toBe(0.86);
        expect(screen.getByText('0.86%')).toBeInTheDocument();
        // 배지는 직전 결제일 대비(122M → 128M = +4.9%, +6M주)이고, core의 추이 라벨은 따로 나온다.
        expect(screen.getByText('+4.9%')).toBeInTheDocument();
        expect(
            screen.getByText(/2026-08-15 대비 \+600만주/)
        ).toBeInTheDocument();
        expect(screen.getByText(/최근 흐름: /)).toBeInTheDocument();
    });

    it('잔고만 있고 비중 데이터가 없으면 비중 블록을 그리지 않는다', () => {
        render(
            <ShortSection {...shortProps(makeSnapshot({ shortVolume: [] }))} />
        );
        expect(screen.queryByText('일별 장외(TRF) 공매도 비중')).toBeNull();
        expect(screen.queryByText(/장외\(TRF\) 보고분 기준이에요/)).toBeNull();
    });

    it('비중만 있고 잔고가 없으면 잔고 블록을 그리지 않는다', () => {
        render(
            <ShortSection
                {...shortProps(makeSnapshot({ shortInterest: [] }))}
            />
        );
        expect(screen.queryByText('공매도 잔고(주)')).toBeNull();
        expect(
            screen.getByText('일별 장외(TRF) 공매도 비중')
        ).toBeInTheDocument();
    });
});

describe('InsiderSection', () => {
    const snapshot = makeSnapshot();

    it('90일 순매수 요약과 클러스터 매수 배지를 낸다', () => {
        render(<InsiderSection {...insiderProps(snapshot)} />);
        expect(screen.getByText(/^순매수 \S+/)).toBeInTheDocument();
        expect(
            screen.getByText(/클러스터 매수 · 내부자 4명/)
        ).toBeInTheDocument();
    });

    it('거래는 매수/매도 글자 배지와 기타 제외 안내를 낸다', () => {
        render(<InsiderSection {...insiderProps(snapshot)} />);
        expect(screen.getAllByText('매수').length).toBeGreaterThan(0);
        expect(screen.getAllByText('매도').length).toBeGreaterThan(0);
        expect(
            screen.getByText(/기타 신고 1건은 표에서 뺐어요/)
        ).toBeInTheDocument();
    });

    it('SEC 공시 링크는 새 창 + noopener로 연다', () => {
        render(<InsiderSection {...insiderProps(snapshot)} />);
        const link = screen.getAllByRole('link', { name: '공시 보기' })[0];
        expect(link).toHaveAttribute('rel', 'noopener noreferrer');
        expect(link).toHaveAttribute('target', '_blank');
    });

    it('https가 아닌 URL은 링크로 만들지 않는다', () => {
        const txs = [makeTransaction({ url: 'javascript:alert(1)' })];
        render(
            <InsiderSection
                {...insiderProps(
                    makeSnapshot({ insider: { transactions: txs } })
                )}
            />
        );
        expect(screen.queryByRole('link', { name: '공시 보기' })).toBeNull();
    });

    it('내부자 데이터가 없으면 "데이터 없음"이다', () => {
        render(<InsiderSection {...insiderProps(makeEmptySnapshot())} />);
        expect(screen.getByText(/데이터 없음/)).toBeInTheDocument();
    });
});

describe('LargeHoldersSection', () => {
    it('13D는 행동주의, 13G는 단순 투자 배지로 구분한다', () => {
        render(
            <LargeHoldersSection
                filings={[
                    makeLargeHolder(),
                    makeLargeHolder({
                        form: 'SCHEDULE 13G',
                        filer: 'Passive Co',
                    }),
                ]}
            />
        );
        expect(screen.getByText('13D 행동주의')).toBeInTheDocument();
        expect(screen.getByText('13G 단순 투자')).toBeInTheDocument();
    });

    it('빈 목록은 "데이터 없음", null은 불러오지 못함으로 갈라 말한다', () => {
        const { rerender } = render(<LargeHoldersSection filings={[]} />);
        expect(screen.getByText(/데이터 없음/)).toBeInTheDocument();
        rerender(<LargeHoldersSection filings={null} />);
        expect(screen.getByText(/불러오지 못했어요/)).toBeInTheDocument();
    });
});

describe('AsOfNotice', () => {
    it('13F 기준 분기·부분 집계·FINRA 결제일·지연 설명을 모두 적는다', () => {
        const snapshot = makeSnapshot();
        render(<AsOfNotice {...asOfProps(snapshot, true)} />);
        expect(
            screen.getByText('2026-06-30 분기말 · 제출 완료')
        ).toBeInTheDocument();
        expect(
            screen.getByText(/2026-09-30 분기는 일부만 제출된 부분 집계/)
        ).toBeInTheDocument();
        expect(
            screen.getByText(/결제일 2026-09-15|결제일 2026-0\d-15/)
        ).toBeInTheDocument();
        expect(screen.getByText(/마지막 거래일/)).toBeInTheDocument();
        expect(screen.getByText(/최대 45일 안에 제출/)).toBeInTheDocument();
        expect(screen.getByText(/FINRA/)).toBeInTheDocument();
    });

    it('FINRA를 그리지 않으면 FINRA 줄과 출처를 뺀다', () => {
        const snapshot = makeSnapshot({
            shortInterest: null,
            shortVolume: null,
        });
        render(<AsOfNotice {...asOfProps(snapshot, false)} />);
        expect(screen.queryByText(/FINRA/)).toBeNull();
        expect(screen.queryByText('공매도 잔고')).toBeNull();
    });

    it('기관 데이터가 없으면 "데이터 없음"이다', () => {
        const snapshot = makeEmptySnapshot();
        render(<AsOfNotice {...asOfProps(snapshot, false)} />);
        expect(screen.getAllByText('데이터 없음').length).toBeGreaterThan(0);
    });
});

describe('InvestorFlowsContent', () => {
    it('FINRA 켜짐 + 데이터 있음이면 공매도 섹션을 그린다', () => {
        const snapshot = makeSnapshot();
        render(
            <InvestorFlowsContent
                snapshot={snapshot}
                scorecard={evaluate(snapshot)}
                finraEnabled
                regShoEnabled
                readiness={READY_READINESS}
            />
        );
        expect(
            screen.getByRole('heading', { level: 2, name: /^공매도/ })
        ).toBeInTheDocument();
    });

    it('FINRA 플래그가 꺼지면 FINRA 블록과 FINRA 출처가 사라지고, 공매도 섹션은 SEC 결제 불이행으로 남는다', () => {
        const snapshot = makeSnapshot({
            shortInterest: null,
            shortVolume: null,
        });
        render(
            <InvestorFlowsContent
                snapshot={snapshot}
                scorecard={evaluate(snapshot, false)}
                finraEnabled={false}
                regShoEnabled
                readiness={READY_READINESS}
            />
        );
        expect(
            screen.getByRole('heading', { level: 2, name: /^공매도/ })
        ).toBeInTheDocument();
        expect(screen.getByTestId('flows-ftd')).toBeInTheDocument();
        expect(screen.queryByText('공매도 잔고(주)')).toBeNull();
        expect(screen.queryByText(/FINRA/)).toBeNull();
    });

    it('플래그는 켜졌지만 FINRA 데이터가 비었으면 FINRA 블록만 생략한다', () => {
        const snapshot = makeSnapshot({ shortInterest: [], shortVolume: [] });
        render(
            <InvestorFlowsContent
                snapshot={snapshot}
                scorecard={evaluate(snapshot)}
                finraEnabled
                regShoEnabled
                readiness={READY_READINESS}
            />
        );
        expect(screen.queryByText('공매도 잔고(주)')).toBeNull();
        expect(screen.queryByText('일별 장외(TRF) 공매도 비중')).toBeNull();
        expect(screen.getByTestId('flows-ftd')).toBeInTheDocument();
    });

    it('내부자 데이터가 없어도 나머지 구간은 그린다', () => {
        const snapshot = makeSnapshot({ insider: { transactions: [] } });
        render(
            <InvestorFlowsContent
                snapshot={snapshot}
                scorecard={evaluate(snapshot)}
                finraEnabled
                regShoEnabled
                readiness={READY_READINESS}
            />
        );
        expect(
            screen.getByRole('heading', { level: 2, name: /기관 매수·매도/ })
        ).toBeInTheDocument();
        expect(
            screen.getByText(/신고된 내부자 거래가 없어요/)
        ).toBeInTheDocument();
    });
});

describe('InvestorFlowsEmpty', () => {
    it('"데이터 없음"을 명시한다', () => {
        render(<InvestorFlowsEmpty />);
        expect(screen.getByText(/데이터 없음/)).toBeInTheDocument();
    });
});

describe('분기별 문구 선택(레코드 맵)', () => {
    it('내부자 순매도·균형 문구를 순변화 부호로 고른다', () => {
        const base = makeSnapshot();
        const sellOnly = makeSnapshot({
            insider: {
                transactions: [
                    makeTransaction({
                        type: 'sell',
                        value: 5_000_000,
                        shares: 1000,
                    }),
                ],
            },
        });
        render(<InsiderSection {...insiderProps(sellOnly)} />);
        expect(screen.getByText(/^순매도 /)).toBeInTheDocument();
        expect(base.insider.transactions.length).toBeGreaterThan(0);
    });

    it('4분할 카드: 증가·감소·같음·비교 없음 문구가 각각 나온다', () => {
        const q = makeSnapshot().institutional.quarters;
        const flat = [
            { ...q[0], period: '2025-12-31', newHolders: 310 },
            { ...q[2], period: '2026-03-31' },
        ];
        render(
            <InstitutionalSection
                institutional={{
                    ...makeSnapshot().institutional,
                    quarters: flat,
                }}
                metrics={evaluate(makeSnapshot()).institutional.metrics}
            />
        );
        expect(
            screen.getAllByText('직전 분기와 같아요').length
        ).toBeGreaterThan(0);
        const single = [q[2]];
        render(
            <InstitutionalSection
                institutional={{
                    ...makeSnapshot().institutional,
                    quarters: single,
                }}
                metrics={evaluate(makeSnapshot()).institutional.metrics}
            />
        );
        expect(
            screen.getAllByText('비교할 직전 분기가 없어요').length
        ).toBeGreaterThan(0);
    });

    it('대량보유: 13G·기타 양식 배지', () => {
        render(
            <LargeHoldersSection
                filings={[
                    makeLargeHolder({ form: 'weird', filer: 'Other Co' }),
                ]}
            />
        );
        expect(screen.getByText('기타')).toBeInTheDocument();
    });

    it.each([
        ['rising', '최근 흐름: 증가 추세'],
        ['falling', '최근 흐름: 감소 추세'],
        ['flat', '최근 흐름: 보합'],
    ] as const)('공매도 추이 %s → %s', (trend, text) => {
        const snapshot = makeSnapshot();
        const metrics = {
            ...evaluate(snapshot).short.metrics,
            shortInterestTrend: trend,
        };
        render(
            <ShortInterestBlock
                rows={
                    buildShortInterestView(snapshot.shortInterest ?? [], null)
                        .rows
                }
                metrics={metrics}
                previousChange={null}
            />
        );
        expect(screen.getByText(text)).toBeInTheDocument();
    });
});
