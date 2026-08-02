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

describe('SnapshotSummarySection — 기준일 표기', () => {
    it('asOf가 있으면 "지난 AI 분석" 배지와 실제 기준일 캡션을 렌더한다', () => {
        render(
            <SnapshotSummarySection
                displayName="Apple Inc."
                asOf={new Date('2026-07-31T20:00:00Z')}
            >
                <p>본문</p>
            </SnapshotSummarySection>
        );

        expect(screen.getByText('지난 AI 분석')).toBeInTheDocument();
        expect(
            screen.getByText(/2026년 7월 31일 미국 장마감 기준/)
        ).toBeInTheDocument();
    });

    // C5(감사): 이전에는 1일 전 케이스와 완전히 같은 날짜(2026-07-31T20:00:00Z)를
    // 재사용해 "7일 된 스냅샷"이라는 제목이 실제로는 아무것도 검증하지 않았다.
    // 서로 다른 age의 두 스냅샷을 각각 렌더해, 둘 다 "전일"이 아니라 각자의
    // 실제 기준일을 렌더하는지 확인한다.
    it.each([
        {
            label: '1일 된 스냅샷',
            asOf: new Date('2026-07-31T20:00:00Z'),
            expectedDate: '2026년 7월 31일',
        },
        {
            label: '6일 23시간 된 스냅샷',
            asOf: new Date('2026-07-25T21:00:00Z'),
            expectedDate: '2026년 7월 25일',
        },
    ])(
        'asOf가 있으면 "전일" 고정 문구 대신 자신의 실제 기준일을 렌더한다 — $label',
        ({ asOf, expectedDate }) => {
            render(
                <SnapshotSummarySection displayName="Apple Inc." asOf={asOf}>
                    <p>본문</p>
                </SnapshotSummarySection>
            );

            expect(
                screen.queryByText(/전일 장마감 기준/)
            ).not.toBeInTheDocument();
            expect(
                screen.getByText(new RegExp(`${expectedDate} 미국 장마감 기준`))
            ).toBeInTheDocument();
        }
    );

    it('asOf가 없으면 기존 캡션으로 폴백한다', () => {
        render(
            <SnapshotSummarySection displayName="Apple Inc.">
                <p>본문</p>
            </SnapshotSummarySection>
        );

        expect(screen.getByText(/전일 장마감 기준/)).toBeInTheDocument();
        expect(screen.queryByText('지난 AI 분석')).not.toBeInTheDocument();
    });
});

describe('SnapshotSummarySection — Invalid Date (A1)', () => {
    it('asOf가 Invalid Date이면 throw하지 않고 고정 캡션으로 폴백하며 배지도 렌더하지 않는다', () => {
        expect(() =>
            render(
                <SnapshotSummarySection
                    displayName="Apple Inc."
                    asOf={new Date(NaN)}
                >
                    <p>본문</p>
                </SnapshotSummarySection>
            )
        ).not.toThrow();

        expect(screen.getByText(/전일 장마감 기준/)).toBeInTheDocument();
        expect(screen.queryByText('지난 AI 분석')).not.toBeInTheDocument();
    });
});
