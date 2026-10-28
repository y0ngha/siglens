// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import type { InvestorFlowsPipelineReadiness } from '@/entities/investor-flows/model';
import { InvestorFlowsContent } from '../InvestorFlowsContent';
import { InvestorFlowsEmpty } from '../InvestorFlowsEmpty';
import { AsOfNotice } from '../sections/AsOfNotice';
import { InstitutionalSection } from '../sections/InstitutionalSection';
import { ScorecardCard } from '../sections/ScorecardCard';
import { resolveCollectingArms } from '@/entities/investor-flows/lib/investorFlowsReadiness';
import type { CollectingArms } from '@/entities/investor-flows/model';
import {
    collectingAxes,
    temporarilyUnavailableAxes,
} from '../utils/collecting';
import {
    evaluate,
    makeEmptySnapshot,
    makeSnapshot,
} from './fixtures/flowsFixtures';

vi.mock('@/shared/ui/InfoTooltip', () => ({
    InfoTooltip: ({ children }: { children: React.ReactNode }) => (
        <span data-testid="info-tooltip">{children}</span>
    ),
}));

const READY: InvestorFlowsPipelineReadiness = {
    institutional: 'ready',
    short: 'ready',
    failsToDeliver: 'ready',
    filings: 'ready',
    thresholdList: 'ready',
    dart: 'ready',
};
const COLLECTING: InvestorFlowsPipelineReadiness = {
    institutional: 'collecting',
    short: 'collecting',
    failsToDeliver: 'collecting',
    filings: 'collecting',
    thresholdList: 'collecting',
    dart: 'collecting',
};
const UNKNOWN: InvestorFlowsPipelineReadiness = {
    institutional: 'unknown',
    short: 'unknown',
    failsToDeliver: 'unknown',
    filings: 'unknown',
    thresholdList: 'unknown',
    dart: 'unknown',
};
const NO_ARMS: CollectingArms = {
    institutional: false,
    short: false,
    failsToDeliver: false,
    proposedSales: false,
    offerings: false,
    thresholdList: false,
};

/** 실제 파이프라인이 비어 있을 때의 스냅샷: DB 원천(13F·FINRA·SEC)은 비고 내부자·13D/G는 FMP라 있다. */
function makeBootstrapSnapshot() {
    return makeSnapshot({
        institutional: { quarters: [], topHolders: [], topHoldersPeriod: null },
        shortInterest: [],
        shortVolume: [],
        failsToDeliver: [],
        proposedSales: [],
        offerings: [],
        thresholdList: null,
    });
}

const INSTITUTIONAL_TITLE = '기관 보유 데이터를 모으는 중이에요';
const SHORT_TITLE = 'FINRA 공매도 데이터를 모으는 중이에요';
const FTD_TITLE = '결제 불이행 데이터를 모으는 중이에요';
const FILINGS_TITLE = 'SEC 공시를 모으는 중이에요';

function renderContent(
    readiness: InvestorFlowsPipelineReadiness,
    snapshot = makeBootstrapSnapshot(),
    finraEnabled = true,
    regShoEnabled = true
) {
    return render(
        <InvestorFlowsContent
            snapshot={snapshot}
            scorecard={evaluate(snapshot, finraEnabled)}
            finraEnabled={finraEnabled}
            regShoEnabled={regShoEnabled}
            readiness={readiness}
        />
    );
}

/** 기관 구간(`h2`)의 `section` — 기준 시점 카드의 "데이터 없음"과 섞이지 않게 범위를 좁힌다. */
const institutionalSection = (): HTMLElement =>
    screen
        .getByRole('heading', { level: 2, name: /기관 매매/ })
        .closest('section') as HTMLElement;

const shortSection = (): HTMLElement =>
    screen
        .getByRole('heading', { level: 2, name: /^공매도/ })
        .closest('section') as HTMLElement;

describe('temporarilyUnavailableAxes', () => {
    it('maps degraded parts to the axes they starve (13D/G → large holders, float → short), without duplicates', () => {
        expect(temporarilyUnavailableAxes(undefined, true)).toEqual([]);
        expect(
            temporarilyUnavailableAxes(['largeHolders', 'float'], true)
        ).toEqual(['largeHolders', 'short']);
    });

    it('does not blame the float outage for a short axis that has no FINRA rows (FINRA off or empty for the symbol)', () => {
        expect(
            temporarilyUnavailableAxes(['largeHolders', 'float'], false)
        ).toEqual(['largeHolders']);
    });
});

describe('InvestorFlowsContent with a snapshot degraded by a transient FMP error', () => {
    it('says "temporarily unavailable" on the large-holder axis and section instead of "no data"', () => {
        const snapshot = {
            ...makeSnapshot({ largeHolders: null }),
            degraded: ['largeHolders'] as const,
        };
        renderContent(READY, snapshot);
        const card = screen
            .getByRole('heading', { level: 3, name: /대량보유/ })
            .closest('li') as HTMLElement;
        expect(within(card).getByText('일시 조회 불가')).toBeInTheDocument();
        expect(
            screen.getByText(/대량보유 공시를 일시적으로 불러오지 못했어요/)
        ).toBeInTheDocument();
    });
});

describe('collectingAxes', () => {
    it('수집 중인 축 이름만 낸다(증자 희석 축은 증자 공시 갈래를 따른다)', () => {
        expect(collectingAxes({ ...NO_ARMS, institutional: true })).toEqual([
            'institutional',
        ]);
        expect(
            collectingAxes({
                ...NO_ARMS,
                institutional: true,
                short: true,
                offerings: true,
            })
        ).toEqual(['institutional', 'short', 'dilution']);
        expect(collectingAxes(NO_ARMS)).toEqual([]);
    });

    it('resolveCollectingArms의 결과를 그대로 받는다(배선)', () => {
        const arms = resolveCollectingArms({
            readiness: COLLECTING,
            snapshot: makeBootstrapSnapshot(),
            finraEnabled: true,
            regShoEnabled: true,
        });
        expect(collectingAxes(arms)).toEqual([
            'institutional',
            'short',
            'dilution',
        ]);
    });
});

describe('InvestorFlowsContent — 수집 중 안내', () => {
    it('수집 중에는 13F 구간이 "데이터 없음" 대신 안내를 낸다', () => {
        renderContent(COLLECTING);
        const section = institutionalSection();
        expect(
            within(section).getByText(INSTITUTIONAL_TITLE)
        ).toBeInTheDocument();
        expect(
            within(section).getByText(/SEC 13F 공시를 처음 모으고 있어요/)
        ).toBeInTheDocument();
        expect(within(section).queryByText(/데이터 없음/)).toBeNull();
    });

    it('수집 중에는 공매도 섹션 안에 FINRA·결제 불이행·과열 목록 안내가 나온다', () => {
        renderContent(COLLECTING);
        const section = shortSection();
        expect(within(section).getByText(SHORT_TITLE)).toBeInTheDocument();
        expect(
            within(section).getByTestId('flows-collecting-short')
        ).toBeInTheDocument();
        expect(within(section).getByText(FTD_TITLE)).toBeInTheDocument();
        expect(
            within(section).getByText('과열 목록을 모으는 중이에요.')
        ).toBeInTheDocument();
    });

    it('수집 중에는 Form 144와 증자 공시 자리에 SEC 공시 안내가 나온다', () => {
        renderContent(COLLECTING);
        expect(
            within(screen.getByTestId('flows-form144')).getByText(FILINGS_TITLE)
        ).toBeInTheDocument();
        const dilution = screen
            .getByRole('heading', { level: 2, name: /^증자 희석 공시/ })
            .closest('section') as HTMLElement;
        expect(within(dilution).getByText(FILINGS_TITLE)).toBeInTheDocument();
    });

    it('준비가 끝난 뒤에는 빈 구간이 "데이터 없음"·"기록 없음"이고 FINRA 블록은 생략한다', () => {
        renderContent(READY);
        expect(screen.queryByText(INSTITUTIONAL_TITLE)).toBeNull();
        expect(screen.queryByText(SHORT_TITLE)).toBeNull();
        expect(screen.queryByText(FTD_TITLE)).toBeNull();
        expect(screen.queryByText(FILINGS_TITLE)).toBeNull();
        expect(
            within(institutionalSection()).getByText(
                /이 종목의 기관 보유\(13F\) 데이터가 아직 없어요/
            )
        ).toBeInTheDocument();
        expect(
            within(shortSection()).getByText(/결제 불이행 기록이 없어요/)
        ).toBeInTheDocument();
        expect(
            within(shortSection()).queryByText('공매도 잔고(주)')
        ).toBeNull();
    });

    it('상태를 못 읽었을 때(unknown)도 있는 그대로 그린다 — 장애를 수집 중이라고 말하지 않는다', () => {
        renderContent(UNKNOWN);
        expect(screen.queryByText(INSTITUTIONAL_TITLE)).toBeNull();
        expect(screen.queryByText(SHORT_TITLE)).toBeNull();
        expect(
            within(institutionalSection()).getByText(/데이터 없음/)
        ).toBeInTheDocument();
    });

    it('갈래는 독립이다: 공매도만 수집 중이면 공매도 안내만 나온다', () => {
        renderContent({ ...READY, short: 'collecting' });
        expect(screen.queryByText(FTD_TITLE)).toBeNull();
        expect(screen.queryByText(INSTITUTIONAL_TITLE)).toBeNull();
        expect(screen.getByText(SHORT_TITLE)).toBeInTheDocument();
        expect(
            within(institutionalSection()).getByText(/데이터 없음/)
        ).toBeInTheDocument();
    });

    it('행 단위 구간(공매도)은 데이터가 있으면 수집 중 표시여도 안내 없이 데이터를 그린다', () => {
        renderContent(COLLECTING, makeSnapshot());
        expect(screen.queryByText(SHORT_TITLE)).toBeNull();
    });

    it('13F는 데이터가 있어도 수집 중이면 부분 집계 대신 안내만 낸다(차트·상위 보유 기관 표를 숨긴다)', () => {
        renderContent(COLLECTING, makeSnapshot());
        const section = within(institutionalSection());
        expect(section.getByText(INSTITUTIONAL_TITLE)).toBeInTheDocument();
        expect(
            section.queryByRole('list', { name: /분기별 기관 순매수/ })
        ).toBeNull();
        expect(
            section.queryByRole('heading', { name: /상위 보유 기관/ })
        ).toBeNull();
    });

    it('13F가 준비되면 같은 데이터를 그대로 그린다', () => {
        renderContent(
            { ...COLLECTING, institutional: 'ready' },
            makeSnapshot()
        );
        expect(screen.queryByText(INSTITUTIONAL_TITLE)).toBeNull();
        expect(
            screen.getByRole('list', { name: /분기별 기관 순매수/ })
        ).toBeInTheDocument();
    });

    it('FINRA 플래그가 꺼져 있으면 FINRA 안내는 나오지 않고 결제 불이행 안내만 남는다', () => {
        renderContent(COLLECTING, makeBootstrapSnapshot(), false);
        expect(screen.queryByText(SHORT_TITLE)).toBeNull();
        expect(within(shortSection()).getByText(FTD_TITLE)).toBeInTheDocument();
        expect(screen.getByText(INSTITUTIONAL_TITLE)).toBeInTheDocument();
    });

    it('Reg SHO 플래그가 꺼져 있으면 수집 중이어도 과열 목록 줄이 아예 없다', () => {
        renderContent(COLLECTING, makeBootstrapSnapshot(), true, false);
        expect(screen.queryByTestId('flows-threshold')).toBeNull();
        expect(screen.queryByText(/Reg SHO/)).toBeNull();
    });

    it('내부자·13D/G 구간은 수집 중과 무관하게 라이브 데이터를 그린다', () => {
        renderContent(COLLECTING);
        expect(
            screen.getByRole('heading', { level: 2, name: /^내부자 거래/ })
        ).toBeInTheDocument();
        expect(
            screen.getAllByText(/Fixture Director A/).length
        ).toBeGreaterThan(0);
    });
});

describe('ScorecardCard — 수집 중 라벨', () => {
    it('수집 중인 축은 "데이터 부족" 대신 "수집 중"이고, 그 밖의 부족한 축은 그대로 "데이터 부족"이다', () => {
        const snapshot = makeBootstrapSnapshot();
        render(
            <ScorecardCard
                scorecard={evaluate(snapshot)}
                collectingAxes={['institutional', 'short']}
            />
        );
        const axisCard = (name: RegExp) =>
            screen
                .getByRole('heading', { level: 3, name })
                .closest('li') as HTMLElement;
        for (const axis of [/^기관/, /^공매도/]) {
            expect(
                within(axisCard(axis)).getByText('수집 중')
            ).toBeInTheDocument();
            expect(
                within(axisCard(axis)).queryByText('데이터 부족')
            ).toBeNull();
            expect(
                within(axisCard(axis)).getByText(
                    '데이터를 모으는 중이라 아직 점수에 반영하지 않았어요.'
                )
            ).toBeInTheDocument();
        }
        // 내부자는 라이브 데이터가 있어 점수가 있고, 수집 중 표시도 없다.
        expect(within(axisCard(/^내부자/)).queryByText('수집 중')).toBeNull();
    });

    it('수집 중 표시는 데이터가 있어 점수가 매겨진 축에는 영향이 없다', () => {
        render(
            <ScorecardCard
                scorecard={evaluate(makeSnapshot())}
                collectingAxes={['institutional']}
            />
        );
        expect(screen.queryByText('수집 중')).toBeNull();
    });

    it('collectingAxes를 안 주면 "데이터 부족" 라벨 그대로다', () => {
        render(<ScorecardCard scorecard={evaluate(makeEmptySnapshot())} />);
        expect(screen.queryByText('수집 중')).toBeNull();
        expect(screen.getAllByText('데이터 부족').length).toBeGreaterThan(0);
    });
});

describe('InvestorFlowsContent — 점수 카드 연동', () => {
    it('수집 중이면 점수 카드에 공매도 축이 "수집 중"으로 나타난다(숨기지 않는다)', () => {
        renderContent(COLLECTING);
        const card = screen
            .getByRole('heading', { level: 3, name: /^공매도/ })
            .closest('li') as HTMLElement;
        expect(within(card).getByText('수집 중')).toBeInTheDocument();
    });

    it('준비 후 빈 공매도 축은 "수집 중"이 아니라 "데이터 부족"이다', () => {
        renderContent(READY);
        const card = screen
            .getByRole('heading', { level: 3, name: /^공매도/ })
            .closest('li') as HTMLElement;
        expect(within(card).queryByText('수집 중')).toBeNull();
        expect(within(card).getByText('데이터 부족')).toBeInTheDocument();
    });
});

describe('InstitutionalSection 단독', () => {
    it('collecting이면 데이터가 있어도(부분 집계) 안내만 그린다', () => {
        render(
            <InstitutionalSection
                institutional={makeSnapshot().institutional}
                metrics={evaluate(makeSnapshot()).institutional.metrics}
                collecting
            />
        );
        expect(screen.getByText(INSTITUTIONAL_TITLE)).toBeInTheDocument();
        expect(
            screen.queryByRole('heading', { name: /상위 보유 기관/ })
        ).toBeNull();
    });

    it('collecting이 아니면 데이터를 그린다', () => {
        render(
            <InstitutionalSection
                institutional={makeSnapshot().institutional}
                metrics={evaluate(makeSnapshot()).institutional.metrics}
            />
        );
        expect(screen.queryByText(INSTITUTIONAL_TITLE)).toBeNull();
        expect(
            screen.getByRole('heading', { name: /상위 보유 기관/ })
        ).toBeInTheDocument();
    });

    it('안내는 서버에서 그려지는 정적 텍스트다(role=note, 클라이언트 전용 브리지 없음)', () => {
        render(
            <InstitutionalSection
                institutional={makeBootstrapSnapshot().institutional}
                metrics={
                    evaluate(makeBootstrapSnapshot()).institutional.metrics
                }
                collecting
            />
        );
        expect(
            screen.getByTestId('flows-collecting-institutional')
        ).toHaveAttribute('role', 'note');
    });
});

describe('InvestorFlowsEmpty — 수집 중', () => {
    it('collecting이면 "데이터 없음" 대신 모으는 중 문구를 낸다', () => {
        render(<InvestorFlowsEmpty collecting />);
        expect(
            screen.getByRole('heading', {
                name: '수급 데이터를 모으는 중이에요',
            })
        ).toBeInTheDocument();
        expect(screen.queryByText(/데이터 없음/)).toBeNull();
    });

    it('13F만 수집 중이면(공매도는 수집 중이 아니거나 FINRA 꺼짐) 본문은 13F만 말한다', () => {
        render(<InvestorFlowsEmpty collecting />);
        expect(
            screen.getByText(/기관 보유\(13F\) 데이터를 처음 모으고/)
        ).toBeVisible();
        expect(screen.queryByText(/공매도/)).toBeNull();
    });

    it('13F와 공매도가 모두 수집 중이면 본문이 둘 다 말한다', () => {
        render(<InvestorFlowsEmpty collecting shortCollecting />);
        expect(
            screen.getByText(/13F\)와 공매도 데이터를 처음 모으고/)
        ).toBeVisible();
    });

    it('공매도만 수집 중(13F는 준비)이면 수집 중 문구가 아니라 일반 빈 상태다', () => {
        render(<InvestorFlowsEmpty shortCollecting />);
        expect(screen.getByText(/데이터 없음/)).toBeInTheDocument();
        expect(screen.queryByText(/모으는 중/)).toBeNull();
    });

    it('기본값은 "데이터 없음"이다', () => {
        render(<InvestorFlowsEmpty />);
        expect(screen.getByText(/데이터 없음/)).toBeInTheDocument();
        expect(screen.queryByText(/모으는 중/)).toBeNull();
    });
});

describe('AsOfNotice — 수집 중 행', () => {
    const snapshot = makeBootstrapSnapshot();
    const freshness = evaluate(snapshot).freshness;
    const renderAsOf = (
        collecting: Partial<CollectingArms>,
        showFinra = true
    ) =>
        render(
            <AsOfNotice
                freshness={freshness}
                snapshotAsOf={snapshot.asOf}
                showFinra={showFinra}
                regShoEnabled={false}
                thresholdAsOf={null}
                collecting={{ ...NO_ARMS, ...collecting }}
            />
        );
    const row = (term: string) =>
        screen.getByText(term).closest('div') as HTMLElement;

    it('collecting: 그 구간의 행이 "데이터 없음" 대신 "수집 중"이다', () => {
        renderAsOf({
            institutional: true,
            short: true,
            failsToDeliver: true,
            offerings: true,
        });
        for (const term of [
            '기관 보유(13F)',
            '공매도 잔고',
            '일별 공매도 비중',
            '결제 불이행(FTD)',
            'Form 144와 증자 공시',
        ]) {
            expect(within(row(term)).getByText('수집 중')).toBeVisible();
        }
    });

    it('ready/empty(플래그 없음): 빈 13F·FINRA·FTD 행은 "데이터 없음"이다', () => {
        renderAsOf({});
        expect(screen.queryByText('수집 중')).toBeNull();
        for (const term of [
            '기관 보유(13F)',
            '공매도 잔고',
            '일별 공매도 비중',
            '결제 불이행(FTD)',
        ]) {
            expect(within(row(term)).getByText('데이터 없음')).toBeVisible();
        }
    });

    it('과열 목록 행: 첫 목록을 모으는 중이면 "수집 중", 아니면 상태가 없어도 "데이터 없음"이다', () => {
        const renderThreshold = (thresholdList: boolean) =>
            render(
                <AsOfNotice
                    freshness={freshness}
                    snapshotAsOf={snapshot.asOf}
                    showFinra={false}
                    regShoEnabled
                    thresholdAsOf={null}
                    collecting={{ ...NO_ARMS, thresholdList }}
                />
            );
        const { unmount } = renderThreshold(true);
        expect(
            within(row('Reg SHO 과열 목록')).getByText('수집 중')
        ).toBeVisible();
        unmount();
        renderThreshold(false);
        expect(
            within(row('Reg SHO 과열 목록')).getByText('데이터 없음')
        ).toBeVisible();
    });

    it('13F만 수집 중이면 다른 행은 "데이터 없음"을 유지한다', () => {
        renderAsOf({ institutional: true });
        expect(
            within(row('기관 보유(13F)')).getByText('수집 중')
        ).toBeVisible();
        expect(
            within(row('결제 불이행(FTD)')).getByText('데이터 없음')
        ).toBeVisible();
    });
});

describe('AsOfNotice — 13F 부분 집계', () => {
    it('점수표에 기준 분기가 있어도 13F가 수집 중이면 행은 "수집 중"이다', () => {
        const snapshot = makeSnapshot();
        const freshness = evaluate(snapshot).freshness;
        expect(freshness.institutionalPeriod).not.toBeNull();
        render(
            <AsOfNotice
                freshness={freshness}
                snapshotAsOf={snapshot.asOf}
                showFinra
                regShoEnabled={false}
                thresholdAsOf={null}
                collecting={{ ...NO_ARMS, institutional: true }}
            />
        );
        const row = screen
            .getByText('기관 보유(13F)')
            .closest('div') as HTMLElement;
        expect(within(row).getByText('수집 중')).toBeVisible();
    });
});

describe('InvestorFlowsContent — 기준 시점 카드 연동', () => {
    const asOfCard = () =>
        screen
            .getByRole('heading', { level: 2, name: /기준 시점/ })
            .closest('section') as HTMLElement;

    it('수집 중이면 기준 시점 카드의 비어 있는 원천 행이 모두 "수집 중"이다', () => {
        renderContent(COLLECTING);
        expect(within(asOfCard()).queryByText('데이터 없음')).toBeNull();
        expect(
            within(asOfCard()).getAllByText('수집 중').length
        ).toBeGreaterThanOrEqual(6);
    });

    it('ready이면 FINRA 행이 없고 13F·FTD·과열 목록 행은 "데이터 없음"이다', () => {
        renderContent(READY);
        expect(within(asOfCard()).queryByText('공매도 잔고')).toBeNull();
        expect(within(asOfCard()).getAllByText('데이터 없음')).toHaveLength(3);
    });
});
