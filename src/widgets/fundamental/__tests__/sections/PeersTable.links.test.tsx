import { render, screen } from '@testing-library/react';
import { PeersTable } from '@/widgets/fundamental/sections/PeersTable';

describe('PeersTable — 링크 여부', () => {
    it('큐레이션 종목만 링크이고 나머지는 텍스트다', () => {
        render(
            <PeersTable
                peers={[
                    { symbol: 'MSFT', companyName: 'Microsoft', marketCap: 3 },
                    {
                        symbol: 'ZZZZNOTCURATED',
                        companyName: 'Obscure',
                        marketCap: 1,
                    },
                ]}
            />
        );

        expect(screen.getByRole('link', { name: 'MSFT' })).toHaveAttribute(
            'href',
            expect.stringContaining('/MSFT')
        );
        expect(screen.getByText('ZZZZNOTCURATED')).toBeInTheDocument();
        expect(
            screen.queryByRole('link', { name: 'ZZZZNOTCURATED' })
        ).not.toBeInTheDocument();
    });
});
