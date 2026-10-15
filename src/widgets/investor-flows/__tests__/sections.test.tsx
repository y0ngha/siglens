// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ScorecardCard } from '../sections/ScorecardCard';
import { InstitutionalSection } from '../sections/InstitutionalSection';
import { ShortSection } from '../sections/ShortSection';
import { InsiderSection } from '../sections/InsiderSection';
import { LargeHoldersSection } from '../sections/LargeHoldersSection';
import { AsOfNotice } from '../sections/AsOfNotice';
import { InvestorFlowsContent } from '../InvestorFlowsContent';
import { InvestorFlowsEmpty } from '../InvestorFlowsEmpty';
import {
    evaluate,
    makeEmptySnapshot,
    makeLargeHolder,
    makeSnapshot,
    makeTransaction,
} from './fixtures/flowsFixtures';

vi.mock('@/shared/ui/InfoTooltip', () => ({
    InfoTooltip: ({ children }: { children: React.ReactNode }) => (
        <span data-testid="info-tooltip">{children}</span>
    ),
}));

describe('ScorecardCard', () => {
    it('종합 점수·라벨(기호+글자)과 4개 축을 그린다', () => {
        const snapshot = makeSnapshot();
        render(<ScorecardCard scorecard={evaluate(snapshot)} showShort />);
        expect(
            screen.getByRole('heading', { level: 2, name: /수급 점수/ })
        ).toBeInTheDocument();
        for (const axis of ['기관', '내부자', '대량보유(5%)', '공매도']) {
            expect(
                screen.getByRole('heading', {
                    level: 3,
                    name: new RegExp(axis.replace(/[()]/g, '\\$&')),
                })
            ).toBeInTheDocument();
        }
    });

    it('showShort가 false면 공매도 축 카드를 그리지 않는다', () => {
        render(
            <ScorecardCard
                scorecard={evaluate(makeSnapshot())}
                showShort={false}
            />
        );
        expect(
            screen.queryByRole('heading', { level: 3, name: /공매도/ })
        ).toBeNull();
    });

    it('데이터가 없는 축은 "데이터 부족"을 말하고 점수 숫자를 내지 않는다', () => {
        render(
            <ScorecardCard
                scorecard={evaluate(makeEmptySnapshot())}
                showShort
            />
        );
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
            <InstitutionalSection
                institutional={makeSnapshot().institutional}
            />
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
            <InstitutionalSection
                institutional={makeSnapshot().institutional}
            />
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
            <InstitutionalSection
                institutional={makeSnapshot().institutional}
            />
        );
        expect(screen.getByTestId('flows-partial-quarter')).toHaveTextContent(
            '2026-09-30'
        );
    });

    it('데이터가 전혀 없으면 "데이터 없음"을 명시한다', () => {
        render(
            <InstitutionalSection
                institutional={makeEmptySnapshot().institutional}
            />
        );
        expect(screen.getByText(/데이터 없음/)).toBeInTheDocument();
    });

    it('필터로 신규·청산 기관만 볼 수 있다', async () => {
        const user = userEvent.setup();
        render(
            <InstitutionalSection
                institutional={makeSnapshot().institutional}
            />
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
            <InstitutionalSection
                institutional={makeSnapshot().institutional}
            />
        );
        for (const label of ['신규', '증가', '감소', '청산']) {
            expect(screen.getAllByText(label).length).toBeGreaterThan(0);
        }
    });
});

describe('ShortSection', () => {
    const snapshot = makeSnapshot();
    const props = {
        shortInterest: snapshot.shortInterest,
        shortVolume: snapshot.shortVolume,
        floatShares: snapshot.floatShares,
        scorecard: evaluate(snapshot),
    };

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
        render(
            <ShortSection
                shortInterest={squeeze.shortInterest}
                shortVolume={squeeze.shortVolume}
                floatShares={squeeze.floatShares}
                scorecard={evaluate(squeeze)}
            />
        );
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
        render(<ShortSection {...props} shortVolume={[]} />);
        expect(screen.queryByText('일별 장외(TRF) 공매도 비중')).toBeNull();
        expect(screen.queryByText(/장외\(TRF\) 보고분 기준이에요/)).toBeNull();
    });

    it('비중만 있고 잔고가 없으면 잔고 블록을 그리지 않는다', () => {
        render(<ShortSection {...props} shortInterest={[]} />);
        expect(screen.queryByText('공매도 잔고(주)')).toBeNull();
        expect(
            screen.getByText('일별 장외(TRF) 공매도 비중')
        ).toBeInTheDocument();
    });
});

describe('InsiderSection', () => {
    const snapshot = makeSnapshot();

    it('90일 순매수 요약과 클러스터 매수 배지를 낸다', () => {
        render(
            <InsiderSection
                transactions={snapshot.insider.transactions}
                scorecard={evaluate(snapshot)}
            />
        );
        expect(screen.getByText(/^순매수 \S+/)).toBeInTheDocument();
        expect(
            screen.getByText(/클러스터 매수 · 내부자 4명/)
        ).toBeInTheDocument();
    });

    it('거래는 매수/매도 글자 배지와 기타 제외 안내를 낸다', () => {
        render(
            <InsiderSection
                transactions={snapshot.insider.transactions}
                scorecard={evaluate(snapshot)}
            />
        );
        expect(screen.getAllByText('매수').length).toBeGreaterThan(0);
        expect(screen.getAllByText('매도').length).toBeGreaterThan(0);
        expect(
            screen.getByText(/기타 신고 1건은 표에서 뺐어요/)
        ).toBeInTheDocument();
    });

    it('SEC 공시 링크는 새 창 + noopener로 연다', () => {
        render(
            <InsiderSection
                transactions={snapshot.insider.transactions}
                scorecard={evaluate(snapshot)}
            />
        );
        const link = screen.getAllByRole('link', { name: '공시 보기' })[0];
        expect(link).toHaveAttribute('rel', 'noopener noreferrer');
        expect(link).toHaveAttribute('target', '_blank');
    });

    it('https가 아닌 URL은 링크로 만들지 않는다', () => {
        const txs = [makeTransaction({ url: 'javascript:alert(1)' })];
        render(
            <InsiderSection
                transactions={txs}
                scorecard={evaluate(
                    makeSnapshot({ insider: { transactions: txs } })
                )}
            />
        );
        expect(screen.queryByRole('link', { name: '공시 보기' })).toBeNull();
    });

    it('내부자 데이터가 없으면 "데이터 없음"이다', () => {
        render(
            <InsiderSection
                transactions={[]}
                scorecard={evaluate(makeEmptySnapshot())}
            />
        );
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
        render(
            <AsOfNotice
                freshness={evaluate(snapshot).freshness}
                snapshotAsOf={snapshot.asOf}
                showShort
            />
        );
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
        render(
            <AsOfNotice
                freshness={evaluate(snapshot, false).freshness}
                snapshotAsOf={snapshot.asOf}
                showShort={false}
            />
        );
        expect(screen.queryByText(/FINRA/)).toBeNull();
        expect(screen.queryByText('공매도 잔고')).toBeNull();
    });

    it('기관 데이터가 없으면 "데이터 없음"이다', () => {
        const snapshot = makeEmptySnapshot();
        render(
            <AsOfNotice
                freshness={evaluate(snapshot).freshness}
                snapshotAsOf={snapshot.asOf}
                showShort={false}
            />
        );
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
            />
        );
        expect(
            screen.getByRole('heading', { level: 2, name: /^공매도/ })
        ).toBeInTheDocument();
    });

    it('FINRA 플래그가 꺼지면 공매도 섹션과 "공매도" 점수 카드가 사라진다(빈 껍데기 없음)', () => {
        const snapshot = makeSnapshot({
            shortInterest: null,
            shortVolume: null,
        });
        render(
            <InvestorFlowsContent
                snapshot={snapshot}
                scorecard={evaluate(snapshot, false)}
                finraEnabled={false}
            />
        );
        expect(screen.queryByRole('heading', { name: /^공매도/ })).toBeNull();
        expect(screen.queryByText(/FINRA/)).toBeNull();
    });

    it('플래그는 켜졌지만 FINRA 데이터가 비었으면 공매도 구간을 생략한다', () => {
        const snapshot = makeSnapshot({ shortInterest: [], shortVolume: [] });
        render(
            <InvestorFlowsContent
                snapshot={snapshot}
                scorecard={evaluate(snapshot)}
                finraEnabled
            />
        );
        expect(screen.queryByRole('heading', { name: /^공매도/ })).toBeNull();
    });

    it('내부자 데이터가 없어도 나머지 구간은 그린다', () => {
        const snapshot = makeSnapshot({ insider: { transactions: [] } });
        render(
            <InvestorFlowsContent
                snapshot={snapshot}
                scorecard={evaluate(snapshot)}
                finraEnabled
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
