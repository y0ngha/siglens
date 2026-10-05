import { render, screen } from '@testing-library/react';
import { OptionsMetricsRow } from '@/widgets/options/OptionsMetricsRow';
import type { OptionsExpirationMetrics } from '@y0ngha/siglens-core';

vi.mock('@/shared/ui/InfoTooltip', () => ({
    InfoTooltip: ({ children }: { children: React.ReactNode }) => (
        <span>{children}</span>
    ),
}));

vi.mock('@/widgets/options/utils/optionsTooltips', () => ({
    MaxPainTooltip: 'Max Pain info',
    PutCallRatioTooltip: 'P/C info',
    AtmIvTooltip: () => 'ATM IV info',
    ImpliedMoveTooltip: () => 'Imp Move info',
}));

vi.mock('@/entities/options-chain/lib/optionsFormatters', () => ({
    formatMaxPain: (v: number | null) =>
        v === null ? '—' : `$${v.toFixed(0)}`,
    formatPutCallRatio: (v: number | null) => (v === null ? '—' : v.toFixed(2)),
    formatAtmIv: (v: number | null) =>
        v === null ? '—' : `${(v * 100).toFixed(1)}%`,
    formatImpliedMove: (v: number | null) =>
        v === null ? '—' : `±${v.toFixed(1)}%`,
    METRIC_PLACEHOLDER: '—',
}));

const METRICS: OptionsExpirationMetrics = {
    expirationDate: '2025-06-20',
    daysToExpiration: 30,
    maxPain: 150,
    maxPainDistancePct: null,
    impliedMoveRange: null,
    putCallRatio: 0.8,
    atmImpliedVolatility: 0.35,
    impliedMovePercent: 4.2,
    topOpenInterestStrikes: [],
    topVolumeStrikes: [],
    topOiBidAskSummary: [],
};

const CAPTURED_AT = '2025-06-13T20:00:00.000Z';

describe('OptionsMetricsRow', () => {
    it('renders all four metric cards', () => {
        render(
            <OptionsMetricsRow
                expirationDate="2025-06-20"
                metrics={METRICS}
                nearestExpiry="2025-06-20"
                oiStale={false}
                capturedAt={CAPTURED_AT}
                showCapturedCaption={false}
            />
        );
        expect(screen.getByText('맥스 페인')).toBeInTheDocument();
        expect(screen.getByText('풋/콜 비율')).toBeInTheDocument();
        expect(screen.getByText('ATM 내재변동성')).toBeInTheDocument();
        expect(screen.getByText('예상 변동폭')).toBeInTheDocument();
    });

    it('카드 라벨을 대문자·넓은 자간으로 강제하지 않는다', () => {
        render(
            <OptionsMetricsRow
                expirationDate="2025-06-20"
                metrics={METRICS}
                nearestExpiry="2025-06-20"
                oiStale={false}
                capturedAt={CAPTURED_AT}
                showCapturedCaption={false}
            />
        );
        const label = screen.getByText('맥스 페인');
        expect(label.className).not.toMatch(/uppercase|tracking-widest/);
    });

    describe('직전 정규장 캡션', () => {
        it('showCapturedCaption이 켜지면 수집 시각(KST)을 중립 문구로 밝힌다', () => {
            render(
                <OptionsMetricsRow
                    expirationDate="2025-06-20"
                    metrics={METRICS}
                    nearestExpiry="2025-06-20"
                    oiStale={false}
                    capturedAt="2025-06-13T20:00:00.000Z"
                    showCapturedCaption
                />
            );
            // 20:00 UTC = 다음 날 05:00 KST.
            expect(
                screen.getByText(
                    /직전 정규장 기준 · .*6월 14일.*05:00 KST 수집/
                )
            ).toBeInTheDocument();
        });

        it('showCapturedCaption이 꺼져 있으면 캡션이 없다', () => {
            render(
                <OptionsMetricsRow
                    expirationDate="2025-06-20"
                    metrics={METRICS}
                    nearestExpiry="2025-06-20"
                    oiStale={false}
                    capturedAt={CAPTURED_AT}
                    showCapturedCaption={false}
                />
            );
            expect(screen.queryByText(/직전 정규장 기준/)).toBeNull();
        });

        it('수집 시각이 잘못된 값이면 캡션을 그리지 않는다(throw 금지)', () => {
            render(
                <OptionsMetricsRow
                    expirationDate="2025-06-20"
                    metrics={METRICS}
                    nearestExpiry="2025-06-20"
                    oiStale={false}
                    capturedAt="not-a-date"
                    showCapturedCaption
                />
            );
            expect(screen.queryByText(/직전 정규장 기준/)).toBeNull();
        });
    });

    it('renders formatted metric values', () => {
        render(
            <OptionsMetricsRow
                expirationDate="2025-06-20"
                metrics={METRICS}
                nearestExpiry="2025-06-20"
                oiStale={false}
                capturedAt={CAPTURED_AT}
                showCapturedCaption={false}
            />
        );
        expect(screen.getByText('$150')).toBeInTheDocument();
        expect(screen.getByText('0.80')).toBeInTheDocument();
        expect(screen.getByText('35.0%')).toBeInTheDocument();
        expect(screen.getByText('±4.2%')).toBeInTheDocument();
    });

    it('renders placeholders when oiStale is true', () => {
        render(
            <OptionsMetricsRow
                expirationDate="2025-06-20"
                metrics={METRICS}
                nearestExpiry="2025-06-20"
                oiStale={true}
                capturedAt={CAPTURED_AT}
                showCapturedCaption={false}
            />
        );
        const dashes = screen.getAllByText('—');
        expect(dashes).toHaveLength(4);
    });

    it('renders aggregate note when expirationDate is all', () => {
        render(
            <OptionsMetricsRow
                expirationDate="all"
                metrics={METRICS}
                nearestExpiry="2025-06-20"
                oiStale={false}
                capturedAt={CAPTURED_AT}
                showCapturedCaption={false}
            />
        );
        expect(screen.getByText(/전체 만기 합산/)).toBeInTheDocument();
    });

    it('falls back to placeholders for every metric when metrics is null', () => {
        render(
            <OptionsMetricsRow
                expirationDate="2025-06-20"
                metrics={null}
                nearestExpiry="2025-06-20"
                oiStale={false}
                capturedAt={CAPTURED_AT}
                showCapturedCaption={false}
            />
        );
        const dashes = screen.getAllByText('—');
        expect(dashes).toHaveLength(4);
    });

    it('does not render aggregate note for specific expiration', () => {
        render(
            <OptionsMetricsRow
                expirationDate="2025-06-20"
                metrics={METRICS}
                nearestExpiry="2025-06-20"
                oiStale={false}
                capturedAt={CAPTURED_AT}
                showCapturedCaption={false}
            />
        );
        expect(screen.queryByText(/전체 만기 합산/)).not.toBeInTheDocument();
    });
});
