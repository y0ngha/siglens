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
import { collectingAxes } from '../utils/collecting';
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
};
const COLLECTING: InvestorFlowsPipelineReadiness = {
    institutional: 'collecting',
    short: 'collecting',
};
const UNKNOWN: InvestorFlowsPipelineReadiness = {
    institutional: 'unknown',
    short: 'unknown',
};

/** 실제 파이프라인이 비어 있을 때의 스냅샷: 13F·FINRA는 비고 내부자·13D/G는 FMP라 있다. */
function makeBootstrapSnapshot() {
    return makeSnapshot({
        institutional: { quarters: [], topHolders: [], topHoldersPeriod: null },
        shortInterest: [],
        shortVolume: [],
    });
}

const INSTITUTIONAL_TITLE = '기관 보유 데이터를 모으는 중이에요';
const SHORT_TITLE = 'FINRA 공매도 데이터를 모으는 중이에요';

function renderContent(
    readiness: InvestorFlowsPipelineReadiness,
    snapshot = makeBootstrapSnapshot(),
    finraEnabled = true
) {
    return render(
        <InvestorFlowsContent
            snapshot={snapshot}
            scorecard={evaluate(snapshot, finraEnabled)}
            finraEnabled={finraEnabled}
            readiness={readiness}
        />
    );
}

/** 기관 구간(`h2`)의 `section` — 기준 시점 카드의 "데이터 없음"과 섞이지 않게 범위를 좁힌다. */
const institutionalSection = (): HTMLElement =>
    screen
        .getByRole('heading', { level: 2, name: /기관 매수·매도/ })
        .closest('section') as HTMLElement;

describe('resolveCollectingArms', () => {
    const base = makeBootstrapSnapshot();
    const input = (
        readiness: InvestorFlowsPipelineReadiness,
        snapshot = base,
        finraEnabled = true
    ) => ({
        readiness,
        institutional: snapshot.institutional,
        shortInterest: snapshot.shortInterest,
        shortVolume: snapshot.shortVolume,
        finraEnabled,
    });

    it('수집 중 + 데이터 없음이면 두 구간 모두 수집 중이다', () => {
        expect(resolveCollectingArms(input(COLLECTING))).toEqual({
            institutional: true,
            short: true,
        });
    });

    it.each([
        ['ready', READY],
        ['unknown', UNKNOWN],
    ])('%s이면 예전 동작이다(수집 중 아님)', (_name, readiness) => {
        expect(resolveCollectingArms(input(readiness))).toEqual({
            institutional: false,
            short: false,
        });
    });

    it('이미 데이터가 있으면 준비 상태가 낡았어도 수집 중이라고 가리지 않는다', () => {
        expect(
            resolveCollectingArms(input(COLLECTING, makeSnapshot()))
        ).toEqual({
            institutional: false,
            short: false,
        });
    });

    it('FINRA가 꺼져 있으면 공매도는 수집 중이 아니다', () => {
        expect(
            resolveCollectingArms(input(COLLECTING, base, false)).short
        ).toBe(false);
    });

    it('collectingAxes는 수집 중인 축 이름만 낸다', () => {
        expect(collectingAxes({ institutional: true, short: false })).toEqual([
            'institutional',
        ]);
        expect(collectingAxes({ institutional: true, short: true })).toEqual([
            'institutional',
            'short',
        ]);
        expect(collectingAxes({ institutional: false, short: false })).toEqual(
            []
        );
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

    it('수집 중에는 숨기던 공매도 구간이 같은 제목 아래 안내로 나타난다', () => {
        renderContent(COLLECTING);
        const section = screen
            .getByRole('heading', { level: 2, name: /^공매도/ })
            .closest('section') as HTMLElement;
        expect(within(section).getByText(SHORT_TITLE)).toBeInTheDocument();
        expect(
            within(section).getByTestId('flows-collecting-short')
        ).toBeInTheDocument();
    });

    it('준비가 끝난 뒤에는 예전과 똑같다: 빈 13F는 "데이터 없음", 빈 공매도는 생략', () => {
        renderContent(READY);
        expect(screen.queryByText(INSTITUTIONAL_TITLE)).toBeNull();
        expect(screen.queryByText(SHORT_TITLE)).toBeNull();
        expect(
            within(institutionalSection()).getByText(
                /이 종목의 기관 보유\(13F\) 데이터가 아직 없어요/
            )
        ).toBeInTheDocument();
        expect(screen.queryByRole('heading', { name: /^공매도/ })).toBeNull();
    });

    it('상태를 못 읽었을 때(unknown)도 예전 동작으로 돌아간다 — 장애를 수집 중이라고 말하지 않는다', () => {
        renderContent(UNKNOWN);
        expect(screen.queryByText(INSTITUTIONAL_TITLE)).toBeNull();
        expect(screen.queryByText(SHORT_TITLE)).toBeNull();
        expect(
            within(institutionalSection()).getByText(/데이터 없음/)
        ).toBeInTheDocument();
    });

    it('13F와 FINRA는 독립이다: 13F만 준비됐으면 공매도만 수집 중이다', () => {
        renderContent({ institutional: 'ready', short: 'collecting' });
        expect(screen.queryByText(INSTITUTIONAL_TITLE)).toBeNull();
        expect(screen.getByText(SHORT_TITLE)).toBeInTheDocument();
        expect(
            within(institutionalSection()).getByText(/데이터 없음/)
        ).toBeInTheDocument();
    });

    it('데이터가 있는 종목은 수집 중 표시여도 안내 없이 데이터를 그린다', () => {
        renderContent(COLLECTING, makeSnapshot());
        expect(screen.queryByText(INSTITUTIONAL_TITLE)).toBeNull();
        expect(screen.queryByText(SHORT_TITLE)).toBeNull();
        expect(
            screen.getByRole('list', { name: /분기별 기관 순매수/ })
        ).toBeInTheDocument();
    });

    it('FINRA 플래그가 꺼져 있으면 공매도 안내도 나오지 않는다', () => {
        renderContent(COLLECTING, makeBootstrapSnapshot(), false);
        expect(screen.queryByText(SHORT_TITLE)).toBeNull();
        expect(screen.queryByRole('heading', { name: /^공매도/ })).toBeNull();
        expect(screen.getByText(INSTITUTIONAL_TITLE)).toBeInTheDocument();
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
                showShort
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
                showShort
                collectingAxes={['institutional']}
            />
        );
        expect(screen.queryByText('수집 중')).toBeNull();
    });

    it('collectingAxes를 안 주면 예전 라벨 그대로다', () => {
        render(
            <ScorecardCard
                scorecard={evaluate(makeEmptySnapshot())}
                showShort
            />
        );
        expect(screen.queryByText('수집 중')).toBeNull();
        expect(screen.getAllByText('데이터 부족').length).toBeGreaterThan(0);
    });

    it('수집 중 공매도 축 카드는 showShort가 켜졌을 때만 나온다', () => {
        render(
            <ScorecardCard
                scorecard={evaluate(makeBootstrapSnapshot())}
                showShort={false}
                collectingAxes={['short']}
            />
        );
        expect(
            screen.queryByRole('heading', { level: 3, name: /^공매도/ })
        ).toBeNull();
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

    it('준비 후 빈 공매도는 점수 카드에서도 예전처럼 빠진다', () => {
        renderContent(READY);
        expect(
            screen.queryByRole('heading', { level: 3, name: /^공매도/ })
        ).toBeNull();
        expect(screen.queryByText('수집 중')).toBeNull();
    });
});

describe('InstitutionalSection 단독', () => {
    it('데이터가 있으면 collecting이어도 안내 대신 데이터를 그린다', () => {
        render(
            <InstitutionalSection
                institutional={makeSnapshot().institutional}
                collecting
            />
        );
        expect(screen.queryByText(INSTITUTIONAL_TITLE)).toBeNull();
    });

    it('안내는 서버에서 그려지는 정적 텍스트다(role=note, 클라이언트 전용 브리지 없음)', () => {
        render(
            <InstitutionalSection
                institutional={makeBootstrapSnapshot().institutional}
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

    it('공매도만 수집 중(13F는 준비)이면 수집 중 문구가 아니라 예전 빈 상태다', () => {
        render(<InvestorFlowsEmpty shortCollecting />);
        expect(screen.getByText(/데이터 없음/)).toBeInTheDocument();
        expect(screen.queryByText(/모으는 중/)).toBeNull();
    });

    it('기본값은 예전 "데이터 없음"이다', () => {
        render(<InvestorFlowsEmpty />);
        expect(screen.getByText(/데이터 없음/)).toBeInTheDocument();
        expect(screen.queryByText(/모으는 중/)).toBeNull();
    });
});

describe('AsOfNotice — 수집 중 행', () => {
    const snapshot = makeBootstrapSnapshot();
    const freshness = evaluate(snapshot).freshness;
    const renderAsOf = (props: {
        institutionalCollecting?: boolean;
        shortCollecting?: boolean;
        showShort?: boolean;
    }) =>
        render(
            <AsOfNotice
                freshness={freshness}
                snapshotAsOf={snapshot.asOf}
                showShort={props.showShort ?? false}
                institutionalCollecting={props.institutionalCollecting}
                shortCollecting={props.shortCollecting}
            />
        );
    const row = (term: string) =>
        screen.getByText(term).closest('div') as HTMLElement;

    it('collecting: 13F·FINRA 행이 "수집 중"이다', () => {
        renderAsOf({
            institutionalCollecting: true,
            shortCollecting: true,
            showShort: true,
        });
        expect(
            within(row('기관 보유(13F)')).getByText('수집 중')
        ).toBeVisible();
        expect(screen.getAllByText('수집 중')).toHaveLength(3);
        expect(screen.queryByText('데이터 없음')).toBeNull();
    });

    it('ready/empty(플래그 없음): 예전처럼 "데이터 없음"이다', () => {
        renderAsOf({ showShort: true });
        expect(screen.queryByText('수집 중')).toBeNull();
        expect(screen.getAllByText('데이터 없음')).toHaveLength(3);
    });

    it('13F만 수집 중이면 공매도 행은 "데이터 없음"을 유지한다', () => {
        renderAsOf({ institutionalCollecting: true, showShort: true });
        expect(screen.getAllByText('수집 중')).toHaveLength(1);
        expect(screen.getAllByText('데이터 없음')).toHaveLength(2);
    });
});

describe('InvestorFlowsContent — 기준 시점 카드 연동', () => {
    it('수집 중이면 기준 시점 카드의 13F·FINRA 행도 "수집 중"이다', () => {
        renderContent(COLLECTING);
        const card = screen
            .getByRole('heading', { level: 2, name: /기준 시점/ })
            .closest('section') as HTMLElement;
        expect(within(card).getAllByText('수집 중')).toHaveLength(3);
        expect(within(card).queryByText('데이터 없음')).toBeNull();
    });

    it('ready이면 예전과 같다(13F 행 "데이터 없음", FINRA 행 없음)', () => {
        renderContent(READY);
        const card = screen
            .getByRole('heading', { level: 2, name: /기준 시점/ })
            .closest('section') as HTMLElement;
        expect(within(card).queryByText('수집 중')).toBeNull();
        expect(within(card).getAllByText('데이터 없음')).toHaveLength(1);
    });
});
