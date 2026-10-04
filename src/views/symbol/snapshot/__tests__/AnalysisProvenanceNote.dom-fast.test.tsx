import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SITE_OPERATOR } from '@/shared/lib/legal';
import type { MarketProfileId } from '@/shared/config/marketProfile/types';
import ko from '../../../../../messages/ko.json';
import { AnalysisProvenanceNote } from '../AnalysisProvenanceNote';

const NOTE = ko.views.symbol.AnalysisProvenanceNote;

const AI_SENTENCE =
    'Siglens가 규칙으로 계산한 값을 AI가 문장으로 정리한 글이에요. 쉽게 보기 글은 계산에 없는 가격이 섞이면 자동으로 다시 쓰거나 그 문장을 빼요. 사람이 한 편씩 읽어 보지는 않으며, 투자 권유가 아니에요.';

describe('AnalysisProvenanceNote', () => {
    describe('variant="ai" (default)', () => {
        it.each([
            ['us-equity', '시세·뉴스 Financial Modeling Prep'],
            ['kr-equity', '시세 Yahoo Finance, 뉴스 네이버 뉴스 검색'],
            ['crypto', '시세·뉴스 Financial Modeling Prep'],
        ] as const satisfies readonly (readonly [MarketProfileId, string])[])(
            '%s: names the data source the market really uses',
            (profile, source) => {
                render(<AnalysisProvenanceNote marketProfile={profile} />);
                expect(
                    screen.getByText(`${AI_SENTENCE} 데이터: ${source} 등.`)
                ).toBeInTheDocument();
            }
        );

        /**
         * 고지는 실제로 하는 자동 검사를 먼저 말하되, 사람이 검토하지 않는다는 사실과
         * 투자 권유가 아니라는 말은 지우지 않는다 — 셋 중 하나라도 빠지면 코드 동작과
         * 고지가 어긋난다.
         */
        it('states the automatic check, that no person reviews it, and that it is not advice', () => {
            render(<AnalysisProvenanceNote marketProfile="us-equity" />);
            const text = document.body.textContent ?? '';
            expect(text).toContain('자동으로 다시 쓰거나 그 문장을 빼요');
            expect(text).toContain('사람이 한 편씩 읽어 보지는 않으며');
            expect(text).toContain('투자 권유가 아니에요');
        });

        it('links to the AI section of the methodology page', () => {
            render(<AnalysisProvenanceNote marketProfile="us-equity" />);
            expect(
                screen.getByRole('link', { name: NOTE.methodLink })
            ).toHaveAttribute('href', '/methodology#ai');
        });

        it('reports errors through a plain mailto anchor to the operator', () => {
            render(<AnalysisProvenanceNote marketProfile="us-equity" />);
            expect(
                screen.getByRole('link', { name: NOTE.reportLink })
            ).toHaveAttribute('href', `mailto:${SITE_OPERATOR.email}`);
            expect(screen.queryByRole('button')).toBeNull();
        });

        it("adds no list items — the renderers' own tests count listitems", () => {
            render(<AnalysisProvenanceNote marketProfile="us-equity" />);
            expect(screen.queryAllByRole('listitem')).toHaveLength(0);
        });

        it('does not render the rule-based link', () => {
            render(<AnalysisProvenanceNote marketProfile="us-equity" />);
            expect(
                screen.queryByRole('link', { name: NOTE.calcLink })
            ).toBeNull();
        });
    });

    describe('variant="rule-based"', () => {
        it.each([
            ['us-equity', '시세 Financial Modeling Prep'],
            ['kr-equity', '시세 Yahoo Finance'],
            ['crypto', '시세 Financial Modeling Prep'],
        ] as const)(
            '%s: says it is rule-calculated and names only the price source',
            (profile, source) => {
                render(
                    <AnalysisProvenanceNote
                        marketProfile={profile}
                        variant="rule-based"
                    />
                );
                expect(
                    screen.getByText(
                        `AI 서술 없이 규칙으로만 계산한 점수예요. 심리를 보여 줄 뿐 앞으로의 가격을 말하지 않아요. 데이터: ${source}.`
                    )
                ).toBeInTheDocument();
                expect(document.body.textContent).not.toMatch(/뉴스/);
            }
        );

        it('links to the fear-greed section and offers no AI wording or report link', () => {
            render(
                <AnalysisProvenanceNote
                    marketProfile="us-equity"
                    variant="rule-based"
                />
            );
            expect(
                screen.getByRole('link', { name: NOTE.calcLink })
            ).toHaveAttribute('href', '/methodology#fear-greed');
            expect(screen.getAllByRole('link')).toHaveLength(1);
            expect(document.body.textContent).not.toContain('AI가 문장으로');
            expect(document.body.textContent).not.toContain('검수');
        });
    });

    describe('presentation', () => {
        it('gives every link a visible focus ring and a 44px touch height', () => {
            render(<AnalysisProvenanceNote marketProfile="us-equity" />);
            for (const link of within(document.body).getAllByRole('link')) {
                const classes = link.className.split(/\s+/);
                expect(classes).toContain('min-h-11');
                expect(classes).toContain('focus-visible:ring-2');
                expect(classes).toContain('focus-visible:ring-primary-500');
            }
        });

        it('is a compact text-xs paragraph in the secondary text token', () => {
            const { container } = render(
                <AnalysisProvenanceNote marketProfile="us-equity" />
            );
            const p = container.querySelector('p')!;
            expect(p.className).toContain('text-xs');
            expect(p.className).toContain('text-secondary-400');
        });
    });
});
