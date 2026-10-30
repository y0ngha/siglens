import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HomeBacktestingCta } from '@/app/[locale]/(home)/_components/HomeBacktestingCta';

describe('HomeBacktestingCta', () => {
    it('질문·본문을 보이고 CTA는 /backtesting으로 간다', () => {
        render(
            <HomeBacktestingCta
                question="믿을 만한가요?"
                body="과거 데이터로 검증했습니다."
                ctaLabel="백테스팅 보기"
            />
        );

        expect(screen.getByText('믿을 만한가요?')).toBeInTheDocument();
        expect(
            screen.getByText('과거 데이터로 검증했습니다.')
        ).toBeInTheDocument();
        expect(
            screen.getByRole('link', { name: '백테스팅 보기' })
        ).toHaveAttribute('href', '/backtesting');
    });
});
