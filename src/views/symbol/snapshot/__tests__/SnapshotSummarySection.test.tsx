import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SnapshotSummarySection } from '../SnapshotSummarySection';

describe('SnapshotSummarySection', () => {
    it('기본 타이틀·전일 장마감 캡션·children을 렌더한다', () => {
        render(
            <SnapshotSummarySection displayName="Apple Inc.">
                <p>본문 텍스트</p>
            </SnapshotSummarySection>
        );

        expect(
            screen.getByRole('heading', { name: '최근 분석 요약' })
        ).toBeInTheDocument();
        expect(screen.getByText(/전일 장마감 기준/)).toBeInTheDocument();
        expect(screen.getByText('본문 텍스트')).toBeInTheDocument();
    });

    it('title prop이 있으면 기본 타이틀 대신 사용한다', () => {
        render(
            <SnapshotSummarySection
                title="커스텀 타이틀"
                displayName="Apple Inc."
            >
                <p>본문</p>
            </SnapshotSummarySection>
        );

        expect(
            screen.getByRole('heading', { name: '커스텀 타이틀' })
        ).toBeInTheDocument();
        expect(
            screen.queryByRole('heading', { name: '최근 분석 요약' })
        ).not.toBeInTheDocument();
    });

    it('displayName을 캡션에 노출한다', () => {
        render(
            <SnapshotSummarySection displayName="Apple Inc.">
                <p>본문</p>
            </SnapshotSummarySection>
        );

        expect(screen.getByText(/Apple Inc\./)).toBeInTheDocument();
    });

    // audit fix FIX 4: 카드 셸은 제품의 우세 패턴(67곳)인
    // `border-secondary-700 bg-secondary-800 rounded-xl border p-6`을 따른다
    // — 이전 소수 패턴(bg-secondary-800 rounded-lg p-4, 5곳)으로의 회귀 가드.
    it('제품 우세 카드 셸 패턴을 사용한다(FIX 4)', () => {
        const { container } = render(
            <SnapshotSummarySection displayName="Apple Inc.">
                <p>본문</p>
            </SnapshotSummarySection>
        );

        const section = container.querySelector('section');
        expect(section?.className).toContain('border-secondary-700');
        expect(section?.className).toContain('bg-secondary-800');
        expect(section?.className).toContain('rounded-xl');
        expect(section?.className).toContain('border');
        expect(section?.className).toContain('p-6');
        expect(section?.className).not.toContain('rounded-lg');
    });

    // audit fix FIX 5: h2는 h3(각 렌더러 내부, text-secondary-200/text-sm)보다
    // 밝고 큰 톤이어야 한다 — 이전엔 h2가 text-secondary-200/text-sm이라 h3와
    // 동일 톤(역전)이었다. 다른 카드 h2 컨벤션과 동일하게 맞춘다.
    it('제품 우세 h2 헤딩 톤(text-lg font-semibold tracking-tight)을 사용한다(FIX 5)', () => {
        render(
            <SnapshotSummarySection displayName="Apple Inc.">
                <p>본문</p>
            </SnapshotSummarySection>
        );

        const heading = screen.getByRole('heading', { name: '최근 분석 요약' });
        expect(heading.className).toContain('text-secondary-100');
        expect(heading.className).toContain('text-lg');
        expect(heading.className).toContain('font-semibold');
        expect(heading.className).toContain('tracking-tight');
        expect(heading.className).not.toContain('text-sm');
    });
});
