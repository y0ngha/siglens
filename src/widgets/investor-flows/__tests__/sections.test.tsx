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
    makeExpandedSnapshot,
    makeKrInsiderRecord,
    makeKrMajorHoldingRecord,
    makeKrSnapshot,
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
    dart: 'ready',
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
            '증자 희석',
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

    it('FMP 일시 오류로 빈 축(unavailableAxes)은 "데이터 부족" 대신 "일시 조회 불가"라고 말한다', () => {
        const snapshot = makeSnapshot({ largeHolders: null });
        render(
            <ScorecardCard
                scorecard={evaluate(snapshot)}
                unavailableAxes={['largeHolders']}
            />
        );
        const card = screen
            .getByRole('heading', { level: 3, name: /대량보유/ })
            .closest('li') as HTMLElement;
        expect(within(card).getByText('일시 조회 불가')).toBeInTheDocument();
        expect(
            within(card).getByText(/일시적으로 불러오지 못했어요/)
        ).toBeInTheDocument();
        expect(within(card).queryByText('데이터 부족')).toBeNull();
    });

    it('수집 중 축 표시가 일시 조회 불가보다 먼저다', () => {
        const snapshot = makeSnapshot({ shortInterest: [], shortVolume: [] });
        render(
            <ScorecardCard
                scorecard={evaluate(snapshot)}
                collectingAxes={['short']}
                unavailableAxes={['short']}
            />
        );
        const card = screen
            .getByRole('heading', { level: 3, name: /공매도/ })
            .closest('li') as HTMLElement;
        expect(within(card).getByText('수집 중')).toBeInTheDocument();
        expect(within(card).queryByText('일시 조회 불가')).toBeNull();
    });

    it('데이터가 없는 축은 "데이터 부족"을 말하고 점수 숫자를 내지 않는다', () => {
        render(<ScorecardCard scorecard={evaluate(makeEmptySnapshot())} />);
        expect(screen.getAllByText('데이터 부족').length).toBeGreaterThan(0);
        expect(
            screen.getByText(/종합 점수를 계산하지 못했어요/)
        ).toBeInTheDocument();
        expect(screen.queryByText(/\d점$/)).toBeNull();
    });

    it('대량보유 근거는 13D/13G 포지션과 신고 수를 따로 말한다', () => {
        render(<ScorecardCard scorecard={evaluate(makeSnapshot())} />);
        const card = axisCard(/대량보유/);
        expect(
            within(card).getByText(
                /13D 포지션 1건, 신고 1회, 13G 포지션 0건, 신고 0회 \(최근 \d+일\)/
            )
        ).toBeInTheDocument();
    });

    it('증자 공시 목록이 비어 있으면 중립 축에 "공시 없음"을 말하고 "0건"·"데이터 부족"을 내지 않는다', () => {
        render(
            <ScorecardCard
                scorecard={evaluate(makeExpandedSnapshot({ offerings: [] }))}
            />
        );
        const card = axisCard(/증자 희석/);
        expect(within(card).getByText('중립')).toBeInTheDocument();
        expect(
            within(card).getByText('확인된 증자/등록 공시 없음')
        ).toBeInTheDocument();
        expect(within(card).queryByText(/0건/)).toBeNull();
        expect(within(card).queryByText('데이터 부족')).toBeNull();
    });
});

describe('ScorecardCard — 한국(DART) 축', () => {
    const KR_AXES = ['largeHolders', 'insider'] as const;
    // 기준일(2026-10-16)에서 90일 창보다 오래된 접수일.
    const OUTSIDE_WINDOW = '2026-05-04';

    it('보고가 모두 채점 창 밖이면 "데이터 부족" 대신 최근 N일 공시 없음과 최신 접수일을 말한다', () => {
        const scorecard = evaluate(
            makeKrSnapshot({
                majorHoldings: [
                    makeKrMajorHoldingRecord({ receiptDate: OUTSIDE_WINDOW }),
                ],
            })
        );
        render(<ScorecardCard scorecard={scorecard} axes={KR_AXES} />);
        const card = axisCard(/대량보유/);
        expect(within(card).getByText('최근 공시 없음')).toBeInTheDocument();
        expect(
            within(card).getByText(
                `최근 ${scorecard.freshness.largeHolderWindow.days}일 공시 없음 (최신 접수일 ${OUTSIDE_WINDOW})`
            )
        ).toBeInTheDocument();
        expect(within(card).queryByText('데이터 부족')).toBeNull();
        expect(within(card).queryByText(/데이터가 부족해/)).toBeNull();
    });

    it('쓸 수 있는 보고가 하나도 없으면 그대로 "데이터 부족"이다', () => {
        render(
            <ScorecardCard
                scorecard={evaluate(makeKrSnapshot({ majorHoldings: [] }))}
                axes={KR_AXES}
            />
        );
        const card = axisCard(/대량보유/);
        expect(within(card).getByText('데이터 부족')).toBeInTheDocument();
        expect(within(card).queryByText('최근 공시 없음')).toBeNull();
    });

    it('수집 중이면 창 밖 보고만 있어도 "수집 중"이 먼저다', () => {
        render(
            <ScorecardCard
                scorecard={evaluate(
                    makeKrSnapshot({
                        majorHoldings: [
                            makeKrMajorHoldingRecord({
                                receiptDate: OUTSIDE_WINDOW,
                            }),
                        ],
                    })
                )}
                axes={KR_AXES}
                collectingAxes={['largeHolders']}
            />
        );
        const card = axisCard(/대량보유/);
        expect(within(card).getByText('수집 중')).toBeInTheDocument();
        expect(within(card).queryByText('최근 공시 없음')).toBeNull();
    });

    it('창 안 보고에 유의미한 변동이 없으면 중립 라벨과 변동 없음 근거를 낸다(데이터 부족 아님)', () => {
        render(
            <ScorecardCard
                scorecard={evaluate(
                    makeKrSnapshot({
                        majorHoldings: [
                            makeKrMajorHoldingRecord({
                                reporter: '삼성물산',
                                ratioPct: 19.69,
                                ratioChangePct: 0,
                                sharesChange: 0,
                            }),
                        ],
                        insiderReports: [makeKrInsiderRecord()],
                    })
                )}
                axes={KR_AXES}
            />
        );
        const majorCard = axisCard(/대량보유/);
        expect(within(majorCard).getByText('중립')).toBeInTheDocument();
        expect(
            within(majorCard).getByText(
                '유의미한 지분 변동 없음 (보고자별 최대 0.00%p)'
            )
        ).toBeInTheDocument();
        const insiderCard = axisCard(/임원\/주요주주/);
        expect(within(insiderCard).getByText('중립')).toBeInTheDocument();
        expect(
            within(insiderCard).getByText('유의미한 보유 변동 없음')
        ).toBeInTheDocument();
        expect(screen.queryByText('데이터 부족')).toBeNull();
    });
});

function axisCard(name: RegExp): HTMLElement {
    return screen
        .getByRole('heading', { level: 3, name })
        .closest('li') as HTMLElement;
}

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
            screen.getByText(/클러스터 매수 \(내부자 4명\)/)
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
        const link = screen.getAllByRole('link', {
            name: 'Fixture Director A 공시 보기',
        })[0];
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
        expect(screen.queryByRole('link', { name: /공시 보기/ })).toBeNull();
    });

    it('점수 창 밖의 거래는 "집계 기간 밖" 묶음으로 따로 그린다(요약 건수와 섞지 않는다)', () => {
        const txs = [
            makeTransaction({ date: '2026-10-10', name: 'Inside Buyer' }),
            makeTransaction({
                date: '2026-05-02',
                name: 'Old Buyer',
                url: 'https://www.sec.gov/old.htm',
            }),
        ];
        render(
            <InsiderSection
                {...insiderProps(
                    makeSnapshot({ insider: { transactions: txs } })
                )}
            />
        );
        const outsideHeading = screen.getByRole('heading', {
            level: 4,
            name: /집계 기간 밖/,
        });
        const outside = outsideHeading.parentElement as HTMLElement;
        expect(
            within(outside).getAllByText('Old Buyer').length
        ).toBeGreaterThan(0);
        expect(within(outside).queryByText('Inside Buyer')).toBeNull();
        expect(
            within(outside).getByText(
                /위 요약의 건수와 금액에는 들어가지 않은 거래예요/
            )
        ).toBeInTheDocument();
    });

    it('창 안 거래가 없고 창 밖만 있으면 "최근 N일 안의 매매 신고는 없어요"와 창 밖 묶음을 낸다', () => {
        const txs = [
            makeTransaction({ date: '2026-05-02', name: 'Old Buyer' }),
        ];
        render(
            <InsiderSection
                {...insiderProps(
                    makeSnapshot({ insider: { transactions: txs } })
                )}
            />
        );
        expect(
            screen.getByText(/최근 90일 안의 매매 신고는 없어요/)
        ).toBeInTheDocument();
        expect(
            screen.getByRole('heading', { level: 4, name: /집계 기간 밖/ })
        ).toBeInTheDocument();
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

    it('FMP 일시 오류(temporarilyUnavailable)면 "일시적으로 불러오지 못했어요"라고 말한다', () => {
        render(<LargeHoldersSection filings={null} temporarilyUnavailable />);
        expect(
            screen.getByText(/대량보유 공시를 일시적으로 불러오지 못했어요/)
        ).toBeInTheDocument();
    });

    it('점수 창(최근 90일 기준)을 밝힌다 — 목록에는 더 오래된 공시도 있다', () => {
        render(
            <LargeHoldersSection
                filings={[makeLargeHolder()]}
                scoringWindow={{
                    days: 90,
                    from: '2026-07-18',
                    to: '2026-10-16',
                }}
            />
        );
        expect(
            screen.getByText(
                '점수는 최근 90일(2026-07-18 ~ 2026-10-16) 공시만 반영해요. 그보다 오래된 공시도 목록에 함께 보여 줘요.'
            )
        ).toBeInTheDocument();
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
            screen.getByText('2026-06-30 분기말, 제출 완료')
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
            screen.getByRole('heading', { level: 2, name: /기관 매매/ })
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
        ['mixed', '최근 흐름: 혼조'],
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

    it('최근 3회 결제 변화율을 양 끝 결제일과 함께 보이고, 끝 날짜가 없으면 숨긴다', () => {
        const snapshot = makeSnapshot();
        const base = evaluate(snapshot).short.metrics;
        const rows = buildShortInterestView(
            snapshot.shortInterest ?? [],
            null
        ).rows;
        const { unmount } = render(
            <ShortInterestBlock
                rows={rows}
                metrics={{
                    ...base,
                    shortInterestChangePct: -25.12,
                    shortInterestChangeFromDate: '2026-08-31',
                    shortInterestChangeToDate: '2026-09-30',
                }}
                previousChange={null}
            />
        );
        expect(
            screen.getByText('2026-08-31 → 2026-09-30 결제일 기준 -25.1%')
        ).toBeInTheDocument();
        unmount();
        render(
            <ShortInterestBlock
                rows={rows}
                metrics={{
                    ...base,
                    shortInterestChangePct: -25.12,
                    shortInterestChangeFromDate: null,
                    shortInterestChangeToDate: null,
                }}
                previousChange={null}
            />
        );
        expect(screen.queryByText(/결제일 기준/)).toBeNull();
    });
});
