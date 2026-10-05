import { render, screen } from '@testing-library/react';
import { PositionCta } from '../ui/PositionCta';

describe('PositionCta', () => {
    it('미국 종목(symbol=AAPL)은 최근 범위를 $ 표기로 렌더한다', () => {
        render(
            <PositionCta
                symbol="AAPL"
                low52w={100}
                high52w={200}
                lastClose={null}
            />
        );
        expect(screen.getByTestId('position-cta-range').textContent).toBe(
            '최근 범위 $100 ~ $200'
        );
    });

    it('한국 상장 종목(symbol=005930.KS)은 최근 범위를 $가 아니라 ₩ 표기로 렌더한다', () => {
        render(
            <PositionCta
                symbol="005930.KS"
                low52w={50_900}
                high52w={88_800}
                lastClose={null}
            />
        );
        expect(screen.getByTestId('position-cta-range').textContent).toBe(
            '최근 범위 ₩50,900 ~ ₩88,800'
        );
    });

    it('sub-$1 crypto 범위(예: low52w=0.0004, high52w=0.0009)는 "$0"으로 뭉개지지 않는다(회귀 방지 — PositionBuilding.dom-fast.test.tsx와 동일 케이스)', () => {
        render(
            <PositionCta
                symbol="SHIB"
                low52w={0.0004}
                high52w={0.0009}
                lastClose={null}
            />
        );
        expect(screen.getByTestId('position-cta-range').textContent).toBe(
            '최근 범위 $0.0004000 ~ $0.0009000'
        );
    });

    it('low52w/high52w가 null이면 심볼과 무관하게 범위 라인을 렌더하지 않는다', () => {
        render(
            <PositionCta
                symbol="005930.KS"
                low52w={null}
                high52w={null}
                lastClose={null}
            />
        );
        expect(
            screen.queryByTestId('position-cta-range')
        ).not.toBeInTheDocument();
    });
});

/**
 * CTA가 심볼을 실어 보내야 퍼널이 의도를 잃지 않는다. 예전에는
 * `href="/onboarding"` 리터럴이라 첫 홉에서 이미 버려졌고, 그 뒤의 로그인
 * 화면도 보유종목 관리 화면도 사용자가 어느 종목을 보다 왔는지 알지 못했다.
 *
 * 리터럴로 되돌려도 화면상 아무 차이가 없어 조용히 회귀한다.
 */
describe('PositionCta 퍼널 컨텍스트', () => {
    it('보유종목 등록 링크가 심볼을 싣는다', () => {
        render(
            <PositionCta
                symbol="AAPL"
                low52w={100}
                high52w={200}
                lastClose={null}
            />
        );
        expect(screen.getByText('보유종목 등록하기')).toHaveAttribute(
            'href',
            '/portfolio?symbol=AAPL'
        );
    });

    it('점이 든 한국 심볼도 안전하게 인코딩된다', () => {
        render(
            <PositionCta
                symbol="005930.KS"
                low52w={100}
                high52w={200}
                lastClose={null}
            />
        );
        expect(screen.getByText('보유종목 등록하기')).toHaveAttribute(
            'href',
            '/portfolio?symbol=005930.KS'
        );
    });
});

/**
 * 비회원·미보유 회원에게 **건물을 먼저** 보여준다 — 평단이 없으니 현재가만 그린 건물이다.
 * 건물은 `next/dynamic`이라 비동기로 도착한다.
 */
describe('PositionCta 건물(현재가만)', () => {
    it('현재가가 있으면 CTA 위에 건물을 그리고, ★평단 마커·평단 라벨·수익률 리드아웃은 없다', async () => {
        render(
            <PositionCta
                symbol="AAPL"
                low52w={100}
                high52w={200}
                lastClose={180}
            />
        );

        const building = await screen.findByTestId('position-building');
        const cta = screen.getByTestId('position-cta');
        expect(cta).toContainElement(building);
        // 건물이 문구보다 먼저(위에) 온다.
        expect(
            building.compareDocumentPosition(
                screen.getByText('보유종목을 등록하면 내 매수 층이 표시돼요')
            ) & Node.DOCUMENT_POSITION_FOLLOWING
        ).toBeTruthy();
        expect(screen.getByTestId('current-marker')).toBeInTheDocument();
        expect(screen.queryByTestId('avg-marker')).not.toBeInTheDocument();
        expect(screen.queryByTestId('avg-floor-note')).not.toBeInTheDocument();
        expect(screen.queryByTestId('return-readout')).not.toBeInTheDocument();
    });

    it('건물 aria 요약은 평단 없이 현재가 문구만 담는다', async () => {
        render(
            <PositionCta
                symbol="AAPL"
                low52w={100}
                high52w={200}
                lastClose={180}
            />
        );

        const building = await screen.findByTestId('position-building');
        const label = building.querySelector('svg')?.getAttribute('aria-label');
        expect(label).toContain('AAPL');
        expect(label).toContain('$180');
        expect(label).not.toContain('평단');
        expect(label).not.toContain('수익률');
    });

    it('안내 문구가 ★ 평단 층이 이 건물에 표시된다고 말한다', () => {
        render(
            <PositionCta
                symbol="AAPL"
                low52w={100}
                high52w={200}
                lastClose={180}
            />
        );

        expect(
            screen.getByText(
                '평단과 수량을 등록하면 이 건물에 내가 산 층(★)도 함께 표시돼요.'
            )
        ).toBeInTheDocument();
    });

    it('거래량 히스토그램이 있으면 층 hover가 켜지도록 volumeByBand를 건물로 넘긴다', async () => {
        render(
            <PositionCta
                symbol="AAPL"
                low52w={100}
                high52w={200}
                lastClose={180}
                volumeByBand={[10, 20, 30, 25, 15]}
            />
        );

        await screen.findByTestId('position-building');
        expect(screen.getByTestId('floor-volume-readout')).toBeInTheDocument();
    });

    it('현재가가 null이면 건물 없이 문구 CTA만 렌더한다', () => {
        render(
            <PositionCta
                symbol="AAPL"
                low52w={100}
                high52w={200}
                lastClose={null}
            />
        );

        expect(screen.queryByTestId('position-building')).toBeNull();
        expect(
            screen.queryByTestId('position-cta-building-loading')
        ).toBeNull();
        expect(screen.getByTestId('position-cta')).toBeInTheDocument();
    });

    it('52주 범위가 퇴화(high<=low)이면 건물을 그리지 않는다', () => {
        render(
            <PositionCta
                symbol="AAPL"
                low52w={200}
                high52w={200}
                lastClose={200}
            />
        );

        expect(screen.queryByTestId('position-building')).toBeNull();
    });
});
