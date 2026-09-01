import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SnapshotSummarySection } from '../SnapshotSummarySection';

describe('SnapshotSummarySection', () => {
    it('기본 타이틀·전일 장마감 캡션·children을 렌더한다', () => {
        render(
            <SnapshotSummarySection
                displayName="Apple Inc."
                marketProfile="us-equity"
            >
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
                marketProfile="us-equity"
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
            <SnapshotSummarySection
                displayName="Apple Inc."
                marketProfile="us-equity"
            >
                <p>본문</p>
            </SnapshotSummarySection>
        );

        expect(screen.getByText(/Apple Inc\./)).toBeInTheDocument();
    });

    // audit fix FIX 4: 카드 셸은 제품의 우세 패턴인
    // `border-secondary-700 bg-secondary-800 rounded-lg border p-6`을 따른다
    // — 이전 소수 패턴(보더 없는 `bg-secondary-800 p-4`)으로의 회귀 가드.
    //
    // 2026-08 리디자인에서 반경이 3단계로 통일돼(`rounded-lg` 하나로 수렴)
    // 두 패턴을 반경으로는 더 이상 구분할 수 없다. 남은 구분자인 **보더 유무와
    // 패딩 크기**로 가드를 옮긴다.
    it('제품 우세 카드 셸 패턴을 사용한다(FIX 4)', () => {
        const { container } = render(
            <SnapshotSummarySection
                displayName="Apple Inc."
                marketProfile="us-equity"
            >
                <p>본문</p>
            </SnapshotSummarySection>
        );

        const section = container.querySelector('section');
        expect(section?.className).toContain('border-secondary-700');
        expect(section?.className).toContain('bg-secondary-800');
        expect(section?.className).toContain('rounded-lg');
        expect(section?.className).toContain('border');
        expect(section?.className).toContain('p-6');
        /* 부분 문자열이 아니라 클래스 토큰으로 비교한다 — `gap-4`가 `p-4`를
           부분 문자열로 포함해 substring 단언은 항상 실패한다. */
        expect(section?.className.split(/\s+/)).not.toContain('p-4');
    });

    // audit fix FIX 5: h2는 h3(각 렌더러 내부, text-secondary-200/text-sm)보다
    // 밝고 큰 톤이어야 한다 — 이전엔 h2가 text-secondary-200/text-sm이라 h3와
    // 동일 톤(역전)이었다. 다른 카드 h2 컨벤션과 동일하게 맞춘다.
    it('제품 우세 h2 헤딩 톤(text-lg font-semibold tracking-tight)을 사용한다(FIX 5)', () => {
        render(
            <SnapshotSummarySection
                displayName="Apple Inc."
                marketProfile="us-equity"
            >
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
                marketProfile="us-equity"
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
                <SnapshotSummarySection
                    displayName="Apple Inc."
                    marketProfile="us-equity"
                    asOf={asOf}
                >
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
            <SnapshotSummarySection
                displayName="Apple Inc."
                marketProfile="us-equity"
            >
                <p>본문</p>
            </SnapshotSummarySection>
        );

        expect(screen.getByText(/전일 장마감 기준/)).toBeInTheDocument();
        expect(screen.queryByText('지난 AI 분석')).not.toBeInTheDocument();
    });
});

/**
 * SEO 감사(2026-08-18): 이전에는 `marketProfile`이 없어 캡션이 항상
 * "미국 장마감 기준"이었다 — 한국 주식·크립토 페이지도 미국 장마감을 자처했다.
 * us-equity 커버리지는 위 두 describe가 이미 촘촘히 맡고 있으므로, 여기서는
 * kr-equity·crypto가 각자의 캡션 문구로 갈리는지만 겨냥한다.
 */
describe('SnapshotSummarySection — 시장별 캡션(kr-equity/crypto)', () => {
    it('kr-equity는 asOf가 있으면 "국내 장마감 기준"을 렌더한다', () => {
        render(
            <SnapshotSummarySection
                displayName="삼성전자"
                marketProfile="kr-equity"
                asOf={new Date('2026-08-14T06:30:00Z')}
            >
                <p>본문</p>
            </SnapshotSummarySection>
        );

        expect(
            screen.getByText(/2026년 8월 14일 국내 장마감 기준/)
        ).toBeInTheDocument();
        expect(screen.queryByText(/미국 장마감 기준/)).not.toBeInTheDocument();
    });

    it('kr-equity는 asOf가 없으면 "전일 국내 장마감 기준"으로 폴백한다', () => {
        render(
            <SnapshotSummarySection
                displayName="삼성전자"
                marketProfile="kr-equity"
            >
                <p>본문</p>
            </SnapshotSummarySection>
        );

        expect(screen.getByText(/전일 국내 장마감 기준/)).toBeInTheDocument();
    });

    it('crypto는 asOf가 있으면 "UTC 기준"을 렌더한다 — "장마감"을 쓰지 않는다', () => {
        render(
            <SnapshotSummarySection
                displayName="비트코인"
                marketProfile="crypto"
                asOf={new Date('2026-08-14T00:00:00Z')}
            >
                <p>본문</p>
            </SnapshotSummarySection>
        );

        expect(
            screen.getByText(/2026년 8월 14일 UTC 기준/)
        ).toBeInTheDocument();
        expect(screen.queryByText(/장마감/)).not.toBeInTheDocument();
    });

    it('crypto는 asOf가 없으면 "전일 UTC 자정 기준"으로 폴백한다', () => {
        render(
            <SnapshotSummarySection
                displayName="비트코인"
                marketProfile="crypto"
            >
                <p>본문</p>
            </SnapshotSummarySection>
        );

        expect(screen.getByText(/전일 UTC 자정 기준/)).toBeInTheDocument();
    });
});

describe('SnapshotSummarySection — Invalid Date (A1)', () => {
    it('asOf가 Invalid Date이면 throw하지 않고 고정 캡션으로 폴백하며 배지도 렌더하지 않는다', () => {
        expect(() =>
            render(
                <SnapshotSummarySection
                    displayName="Apple Inc."
                    marketProfile="us-equity"
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

/**
 * 이 셸은 크롤러에게 본문을 실어 보내는 자리다. 평이화가 있으면 그것을, 없으면
 * 원문을 낸다 — 어느 쪽이든 **비어 있으면 안 된다**.
 */
describe('평이화 연동', () => {
    afterEach(() => {
        delete document.documentElement.dataset.analysisView;
    });

    it('평이화가 있으면 평이화를 렌더한다', () => {
        render(
            <SnapshotSummarySection
                displayName="Apple Inc."
                marketProfile="us-equity"
                plain="애플 주가는 지금 오르는 흐름입니다."
            >
                <p>전문 원문</p>
            </SnapshotSummarySection>
        );

        expect(
            screen.getByText('애플 주가는 지금 오르는 흐름입니다.')
        ).toBeInTheDocument();
        expect(screen.queryByText('전문 원문')).toBeNull();
    });

    it('평이화가 없으면 원문을 렌더한다', () => {
        render(
            <SnapshotSummarySection
                displayName="Apple Inc."
                marketProfile="us-equity"
                plain={null}
            >
                <p>전문 원문</p>
            </SnapshotSummarySection>
        );

        expect(screen.getByText('전문 원문')).toBeInTheDocument();
        expect(screen.queryByRole('radiogroup')).toBeNull();
    });

    /**
     * 차트 탭은 라이브 위젯이 토글을 소유한다. 여기서 또 그리면 한 화면에
     * 쉽게보기가 둘이 된다. 대신 표식을 달아 라이브 평이화가 뜨면 숨는다.
     */
    it('duplicatesLiveWidget이면 토글 없이 표식만 단다', () => {
        const { container } = render(
            <SnapshotSummarySection
                displayName="Apple Inc."
                marketProfile="us-equity"
                plain="애플 주가는 지금 오르는 흐름입니다."
                duplicatesLiveWidget
            >
                <p>전문 원문</p>
            </SnapshotSummarySection>
        );

        expect(screen.queryByRole('radiogroup')).toBeNull();
        expect(container.querySelector('[data-snapshot-prose]')).not.toBeNull();
        // 토글이 없어도 본문은 평이화다 — 봇이 받는 텍스트가 이것이다.
        expect(
            screen.getByText('애플 주가는 지금 오르는 흐름입니다.')
        ).toBeInTheDocument();
    });

    it('일반 탭에는 표식을 달지 않는다 — 스스로 숨으면 안 된다', () => {
        const { container } = render(
            <SnapshotSummarySection
                displayName="Apple Inc."
                marketProfile="us-equity"
                plain="애플 주가는 지금 오르는 흐름입니다."
            >
                <p>전문 원문</p>
            </SnapshotSummarySection>
        );

        expect(container.querySelector('[data-snapshot-prose]')).toBeNull();
        expect(screen.getByRole('radiogroup')).toBeInTheDocument();
    });
});
