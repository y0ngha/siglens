import { render, screen } from '@testing-library/react';
import { PositionCta } from '../ui/PositionCta';

describe('PositionCta', () => {
    it('미국 종목(symbol=AAPL)은 최근 범위를 $ 표기로 렌더한다', () => {
        render(<PositionCta symbol="AAPL" low52w={100} high52w={200} />);
        expect(screen.getByTestId('position-cta-range').textContent).toBe(
            '최근 범위 $100 ~ $200'
        );
    });

    it('한국 상장 종목(symbol=005930.KS)은 최근 범위를 $가 아니라 ₩ 표기로 렌더한다', () => {
        render(
            <PositionCta symbol="005930.KS" low52w={50_900} high52w={88_800} />
        );
        expect(screen.getByTestId('position-cta-range').textContent).toBe(
            '최근 범위 ₩50,900 ~ ₩88,800'
        );
    });

    it('sub-$1 crypto 범위(예: low52w=0.0004, high52w=0.0009)는 "$0"으로 뭉개지지 않는다(회귀 방지 — PositionBuilding.test.tsx와 동일 케이스)', () => {
        render(<PositionCta symbol="SHIB" low52w={0.0004} high52w={0.0009} />);
        expect(screen.getByTestId('position-cta-range').textContent).toBe(
            '최근 범위 $0.0004000 ~ $0.0009000'
        );
    });

    it('low52w/high52w가 null이면 심볼과 무관하게 범위 라인을 렌더하지 않는다', () => {
        render(<PositionCta symbol="005930.KS" low52w={null} high52w={null} />);
        expect(
            screen.queryByTestId('position-cta-range')
        ).not.toBeInTheDocument();
    });
});

/**
 * CTA가 심볼을 실어 보내야 퍼널이 의도를 잃지 않는다. 예전에는
 * `href="/onboarding"` 리터럴이라 첫 홉에서 이미 버려졌고, 그 뒤의 로그인
 * 화면도 온보딩 화면도 사용자가 어느 종목을 보다 왔는지 알지 못했다.
 *
 * 리터럴로 되돌려도 화면상 아무 차이가 없어 조용히 회귀한다.
 */
describe('PositionCta 퍼널 컨텍스트', () => {
    it('보유종목 등록 링크가 심볼을 싣는다', () => {
        render(<PositionCta symbol="AAPL" low52w={100} high52w={200} />);
        expect(screen.getByText('보유종목 등록하기')).toHaveAttribute(
            'href',
            '/onboarding?symbol=AAPL'
        );
    });

    it('점이 든 한국 심볼도 안전하게 인코딩된다', () => {
        render(<PositionCta symbol="005930.KS" low52w={100} high52w={200} />);
        expect(screen.getByText('보유종목 등록하기')).toHaveAttribute(
            'href',
            '/onboarding?symbol=005930.KS'
        );
    });
});
