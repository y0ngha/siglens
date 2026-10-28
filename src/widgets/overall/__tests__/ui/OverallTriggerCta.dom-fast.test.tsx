import { render, screen, fireEvent } from '@testing-library/react';

import { OverallTriggerCta } from '@/widgets/overall/ui/trigger-cta/OverallTriggerCta';

describe('OverallTriggerCta', () => {
    it('renders the heading and description', () => {
        render(<OverallTriggerCta onTrigger={vi.fn()} hasOptions={true} />);

        expect(
            screen.getByRole('heading', { name: /AI 종합 분석/ })
        ).toBeInTheDocument();
        expect(
            screen.getByText(/차트, 옵션, 펀더멘털, 뉴스, 시장 분위기/)
        ).toBeInTheDocument();
    });

    it('calls onTrigger when the button is clicked', () => {
        const handleTrigger = vi.fn();
        render(
            <OverallTriggerCta onTrigger={handleTrigger} hasOptions={true} />
        );

        fireEvent.click(
            screen.getByRole('button', { name: /AI 종합 분석 받기/ })
        );

        expect(handleTrigger).toHaveBeenCalledTimes(1);
    });

    it('has an accessible section landmark', () => {
        render(<OverallTriggerCta onTrigger={vi.fn()} hasOptions={true} />);

        expect(
            screen.getByRole('region', { name: /AI 종합 분석/ })
        ).toBeInTheDocument();
    });

    it('disabled=false (default): button is enabled with "AI 종합 분석 받기" label and no waiting hint', () => {
        render(<OverallTriggerCta onTrigger={vi.fn()} hasOptions={true} />);

        const button = screen.getByRole('button', {
            name: /AI 종합 분석 받기/,
        });
        expect(button).toBeEnabled();
        // section의 aria-busy는 비활성화 상태에서만 true (CTA가 대기 중임을 보조기기에 알림).
        expect(
            screen.getByRole('region', { name: /AI 종합 분석/ })
        ).toHaveAttribute('aria-busy', 'false');
        // 대기 안내 문구는 disabled일 때만 노출된다.
        expect(screen.queryByText(/30초~1분 소요/)).not.toBeInTheDocument();
    });

    it('disabled=true: button is disabled with "뉴스 카드 분석 중…" label, region marks aria-busy, waiting hint is shown', () => {
        const handleTrigger = vi.fn();
        render(
            <OverallTriggerCta
                onTrigger={handleTrigger}
                hasOptions={true}
                disabled
            />
        );

        const button = screen.getByRole('button', {
            name: /뉴스 카드 분석 중…/,
        });
        expect(button).toBeDisabled();
        // disabled 상태에서는 클릭이 onTrigger를 호출하지 않아야 한다(부분 결과 진입 차단).
        fireEvent.click(button);
        expect(handleTrigger).not.toHaveBeenCalled();

        expect(
            screen.getByRole('region', { name: /AI 종합 분석/ })
        ).toHaveAttribute('aria-busy', 'true');
        expect(screen.getByText(/30초~1분 소요/)).toBeInTheDocument();
    });

    it('assetClass="crypto": subtitle lists 차트, 뉴스, 시장 분위기 and omits equity-only words', () => {
        render(
            <OverallTriggerCta
                onTrigger={vi.fn()}
                assetClass="crypto"
                hasOptions={false}
            />
        );

        // Crypto subtitle must be present.
        expect(screen.getByText(/차트, 뉴스, 시장 분위기/)).toBeInTheDocument();

        // Equity-only terms must NOT appear in the rendered output.
        expect(screen.queryByText(/옵션/)).not.toBeInTheDocument();
        expect(screen.queryByText(/펀더멘털/)).not.toBeInTheDocument();
    });

    it('assetClass="crypto": 옵션 탭 유무와 무관하게 같은 부제를 쓴다', () => {
        render(
            <OverallTriggerCta
                onTrigger={vi.fn()}
                assetClass="crypto"
                hasOptions={true}
            />
        );

        expect(screen.getByText(/차트, 뉴스, 시장 분위기/)).toBeInTheDocument();
    });

    it('옵션 탭이 없는 주식(hasOptions=false): 부제가 옵션을 약속하지 않는다', () => {
        render(
            <OverallTriggerCta
                onTrigger={vi.fn()}
                assetClass="equity"
                hasOptions={false}
            />
        );

        expect(
            screen.getByText(/차트, 펀더멘털, 뉴스, 시장 분위기/)
        ).toBeInTheDocument();
        expect(screen.queryByText(/옵션/)).not.toBeInTheDocument();
    });
});
