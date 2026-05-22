/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';

// react-markdown은 ESM-only라 jest의 기본 transform이 처리하지 못한다.
// MarkdownText를 단순 wrapper로 대체해 inline markdown 렌더 경로를 우회한다.
jest.mock('@/components/ui/MarkdownText', () => ({
    MarkdownText: ({ children }: { children: ReactNode }) => (
        <span>{children}</span>
    ),
}));

import { OptionsSummary } from '@/components/overall/sections/OptionsSummary';

describe('OptionsSummary', () => {
    it('bullets를 렌더한다', () => {
        render(
            <OptionsSummary
                bullets={['감마 상승', '풋콜 비율 1.2']}
                oiStale={false}
            />
        );
        expect(screen.getByText('감마 상승')).toBeInTheDocument();
        expect(screen.getByText('풋콜 비율 1.2')).toBeInTheDocument();
    });

    it('bullets가 비어 있으면 "분석 대상 옵션 없음" 안내를 보여준다', () => {
        render(<OptionsSummary bullets={[]} oiStale={false} />);
        expect(screen.getByText(/분석 대상 옵션 없음/)).toBeInTheDocument();
    });

    it('oiStale=true일 때 stale 배지를 보여준다', () => {
        render(<OptionsSummary bullets={['감마 상승']} oiStale={true} />);
        expect(screen.getByText(/OI 데이터 stale/)).toBeInTheDocument();
    });

    it('oiStale=false일 때는 stale 배지를 숨긴다', () => {
        render(<OptionsSummary bullets={['감마 상승']} oiStale={false} />);
        expect(screen.queryByText(/OI 데이터 stale/)).not.toBeInTheDocument();
    });

    it('bullets가 비어 있고 oiStale=true여도 배지를 표시하지 않는다 (분석 자체가 없으므로 stale 의미 없음)', () => {
        render(<OptionsSummary bullets={[]} oiStale={true} />);
        expect(screen.queryByText(/OI 데이터 stale/)).not.toBeInTheDocument();
    });
});
