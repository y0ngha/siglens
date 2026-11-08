import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HomeRadarCta } from '@/app/[locale]/(home)/_components/HomeRadarCta';
import {
    RADAR_DASHBOARDS,
    RADAR_SITE_URL,
    radarDashboardUrl,
} from '@/shared/config/radar';

function renderCta() {
    return render(
        <HomeRadarCta
            title="종목 레이더"
            badge="BETA"
            body="한곳에 모아 봅니다."
            viewAllLabel="전체 보기"
            requestPrompt="보고 싶은 종목이 없나요?"
            requestCta="종목 요청하기"
            chipAriaLabel={name => `${name} 레이더 열기`}
        />
    );
}

describe('HomeRadarCta', () => {
    it('제목·BETA 배지·본문을 보인다', () => {
        renderCta();

        expect(
            screen.getByRole('heading', { name: /종목 레이더/ })
        ).toBeInTheDocument();
        expect(screen.getByText('BETA')).toBeInTheDocument();
        expect(screen.getByText('한곳에 모아 봅니다.')).toBeInTheDocument();
    });

    it('대시보드마다 칩 하나가 있고 각자의 URL 로 같은 탭에서 간다', () => {
        renderCta();

        for (const { slug, label, ticker } of RADAR_DASHBOARDS) {
            const chip = screen.getByRole('link', {
                name: `${label} 레이더 열기`,
            });
            expect(chip).toHaveAttribute('href', radarDashboardUrl(slug));
            expect(chip).not.toHaveAttribute('target');
            expect(chip).toHaveTextContent(`$${ticker}`);
        }
        expect(screen.getAllByRole('listitem')).toHaveLength(
            RADAR_DASHBOARDS.length
        );
    });

    it('전체 보기는 레이더 사이트 루트로 간다', () => {
        renderCta();

        expect(screen.getByRole('link', { name: /전체 보기/ })).toHaveAttribute(
            'href',
            RADAR_SITE_URL
        );
    });

    it('종목 요청 트리거 버튼이 안내 문구와 함께 있다', () => {
        renderCta();

        expect(
            screen.getByText('보고 싶은 종목이 없나요?')
        ).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: '종목 요청하기' })
        ).toBeInTheDocument();
    });
});
