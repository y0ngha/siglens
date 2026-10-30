import { render, screen } from '@testing-library/react';

vi.mock('@/entities/auth/lib/getCurrentUser', () => ({
    getCurrentUser: vi.fn(),
}));
vi.mock('@/features/email-report-settings/ui/ReportSymbolChip', () => ({
    ReportSymbolChip: ({
        symbol,
        name,
        mode,
    }: {
        symbol: string;
        name: string | null;
        mode: string;
    }) => <li data-mode={mode}>{name ?? symbol}</li>,
}));
vi.mock('@/app/[locale]/email-report/_lib/loadReportPreview', () => ({
    loadReportPreview: vi.fn(),
}));

import { loadReportPreview } from '@/app/[locale]/email-report/_lib/loadReportPreview';
import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { ReportPreviewLoader } from '../IncludedSymbolsNote';

describe('ReportPreviewLoader', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('미리보기 로더는 현재 회원의 대상 종목을 상세 그룹에 이름 칩으로 그린다', async () => {
        vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u-1' } as never);
        vi.mocked(loadReportPreview).mockResolvedValue({
            full: [
                { symbol: 'AAPL', name: 'Apple' },
                { symbol: 'TSLA', name: 'Tesla' },
            ],
            brief: [],
            excluded: [{ symbol: 'NVDA', name: 'NVIDIA' }],
            staleExcluded: [{ symbol: 'GONE', name: null }],
        });

        render(await ReportPreviewLoader());

        expect(loadReportPreview).toHaveBeenCalledWith('u-1');
        const group = screen.getByRole('group', { name: '상세' });
        expect(group).toHaveTextContent('Apple');
        expect(group).toHaveTextContent('Tesla');
        expect(screen.getByText('Apple')).toHaveAttribute(
            'data-mode',
            'exclude'
        );
        expect(screen.getByText('NVIDIA')).toHaveAttribute(
            'data-mode',
            'include'
        );
        expect(screen.getByText('GONE')).toHaveAttribute('data-mode', 'clear');
    });

    it('종목 조회가 실패하면(null) 미리보기만 안내로 대체한다', async () => {
        vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u-1' } as never);
        vi.mocked(loadReportPreview).mockResolvedValue(null);

        render(await ReportPreviewLoader());

        expect(
            screen.getByText('리포트 대상 종목을 지금은 불러오지 못했어요.')
        ).toBeInTheDocument();
    });
});
