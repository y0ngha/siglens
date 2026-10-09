import { render, screen } from '@testing-library/react';
import { ReportSymbolsPreview } from '@/features/email-report-settings/ui/ReportSymbolsPreview';

describe('ReportSymbolsPreview', () => {
    it('상세·요약 그룹의 이름 칩과 요약 문장을 그린다', () => {
        render(
            <ReportSymbolsPreview
                preview={{
                    full: [
                        { symbol: 'AAPL', name: 'Apple' },
                        { symbol: '005930.KS', name: null },
                    ],
                    brief: [{ symbol: 'TSLA', name: 'Tesla' }],
                }}
            />
        );

        expect(
            screen.getByText(
                '전체 3개 중 2개는 상세, 나머지 1개는 요약으로 들어가요.'
            )
        ).toBeInTheDocument();
        expect(screen.getByRole('group', { name: '상세' })).toHaveTextContent(
            'Apple'
        );
        expect(screen.getByRole('group', { name: '상세' })).toHaveTextContent(
            '005930.KS'
        );
        expect(screen.getByRole('group', { name: '요약' })).toHaveTextContent(
            'Tesla'
        );
    });

    it('이름이 있어도 심볼을 함께 보이고, 비어 있는 그룹은 그리지 않는다', () => {
        render(
            <ReportSymbolsPreview
                preview={{
                    full: [{ symbol: 'NVDA', name: 'NVIDIA' }],
                    brief: [],
                }}
            />
        );

        expect(screen.getByText('NVIDIA')).toBeInTheDocument();
        expect(screen.getByText('NVDA')).toBeInTheDocument();
        expect(
            screen.queryByRole('group', { name: '요약' })
        ).not.toBeInTheDocument();
    });

    it('종목이 하나도 없으면 빈 상태 문구를 보인다', () => {
        render(<ReportSymbolsPreview preview={{ full: [], brief: [] }} />);

        expect(
            screen.getByText(/아직 보유·관심종목이 없어요/)
        ).toBeInTheDocument();
    });

    it('불러오지 못했으면(null) 안내만 보인다', () => {
        render(<ReportSymbolsPreview preview={null} />);

        expect(
            screen.getByText('리포트 대상 종목을 지금은 불러오지 못했어요.')
        ).toBeInTheDocument();
    });
});
