import { render, screen } from '@testing-library/react';
import { BriefingVolatility } from '@/widgets/dashboard/ui/briefing/BriefingVolatility';

describe('BriefingVolatility', () => {
    it('지수 심볼과 소수 둘째 자리 수치, 해설을 그린다', () => {
        render(
            <BriefingVolatility
                indexSymbol="VIX"
                analysis={{ vixLevel: 14.5, description: 'Low volatility' }}
            />
        );
        expect(screen.getByText('VIX 14.50')).toBeInTheDocument();
        expect(screen.getByText(/Low volatility/)).toBeInTheDocument();
    });

    it('수치가 없으면 해설만 그린다', () => {
        render(
            <BriefingVolatility
                indexSymbol="VIX"
                analysis={{ vixLevel: undefined, description: 'Calm' }}
            />
        );
        expect(screen.getByText('Calm')).toBeInTheDocument();
        expect(screen.queryByText(/VIX/)).not.toBeInTheDocument();
    });

    it('수치도 해설도 없으면 아무것도 그리지 않는다', () => {
        const { container } = render(
            <BriefingVolatility
                indexSymbol="VIX"
                analysis={{ vixLevel: undefined, description: '' }}
            />
        );
        expect(container).toBeEmptyDOMElement();
    });
});
