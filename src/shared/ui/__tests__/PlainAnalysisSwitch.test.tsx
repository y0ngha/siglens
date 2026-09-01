/**
 * `PlainAnalysisSwitch` 컴포넌트 테스트.
 *
 * 감사(M3)에서 이 컴포넌트의 `showPlain`을 `false`로 고정해도 **6,275개 테스트가
 * 전부 통과**했다. 일곱 개 탭이 전부 이 컴포넌트를 거치는데, 어떤 테스트도
 * 비어 있지 않은 `plain`을 넣어 렌더한 적이 없었기 때문이다. 기능이 통째로
 * 죽어도 CI가 초록인 상태였다.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { NextIntlClientProvider } from 'next-intl';
import messages from '../../../../messages/ko.json';
import { PlainAnalysisSwitch } from '../PlainAnalysisSwitch';
import { ANALYSIS_VIEW_STORAGE_KEY } from '@/shared/model/analysisView';

const T = messages.widgets.analysis.viewToggle;
const RAW = '원본 카드 영역';
const PLAIN = '쉽게 쓴 첫 문단입니다.\n\n둘째 문단입니다.';

function renderSwitch(
    props: Partial<Parameters<typeof PlainAnalysisSwitch>[0]> = {}
) {
    return render(
        <NextIntlClientProvider locale="ko" messages={messages}>
            <PlainAnalysisSwitch plain={PLAIN} {...props}>
                <div>{RAW}</div>
            </PlainAnalysisSwitch>
        </NextIntlClientProvider>
    );
}

beforeEach(() => {
    window.localStorage.clear();
});

describe('PlainAnalysisSwitch', () => {
    it('기본값은 쉽게보기 — 산문을 렌더하고 원본은 마운트하지 않는다', () => {
        renderSwitch();
        expect(screen.getByText('쉽게 쓴 첫 문단입니다.')).toBeInTheDocument();
        // 같은 내용을 DOM에 두 벌 두지 않는 것이 의도다(스크린 리더 중복 낭독).
        expect(screen.queryByText(RAW)).not.toBeInTheDocument();
    });

    it('원본으로 전환하면 원본이 마운트되고 산문이 사라진다', () => {
        renderSwitch();
        fireEvent.click(screen.getByRole('radio', { name: T.raw }));
        expect(screen.getByText(RAW)).toBeInTheDocument();
        expect(
            screen.queryByText('쉽게 쓴 첫 문단입니다.')
        ).not.toBeInTheDocument();
    });

    it('하단 CTA를 눌러도 원본으로 전환된다', () => {
        renderSwitch();
        fireEvent.click(screen.getByRole('button', { name: T.cta }));
        expect(screen.getByText(RAW)).toBeInTheDocument();
    });

    /** 아무 일도 하지 않는 토글은 사용자가 고장으로 읽는다. */
    it('plain이 null이면 토글 없이 원본만 렌더한다', () => {
        renderSwitch({ plain: null });
        expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
        expect(screen.getByText(RAW)).toBeInTheDocument();
    });

    it('plain이 공백뿐이어도 토글을 렌더하지 않는다', () => {
        renderSwitch({ plain: '   \n\n  ' });
        expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
        expect(screen.getByText(RAW)).toBeInTheDocument();
    });

    it('저장된 선택이 raw면 처음부터 원본을 렌더한다', () => {
        window.localStorage.setItem(
            ANALYSIS_VIEW_STORAGE_KEY,
            JSON.stringify('raw')
        );
        renderSwitch();
        expect(screen.getByText(RAW)).toBeInTheDocument();
        expect(screen.getByRole('radio', { name: T.raw })).toBeChecked();
    });

    it('전환 선택이 localStorage에 남는다', () => {
        renderSwitch();
        fireEvent.click(screen.getByRole('radio', { name: T.raw }));
        expect(
            window.localStorage.getItem(ANALYSIS_VIEW_STORAGE_KEY)
        ).toContain('raw');
    });

    /** 데스크톱 패널과 모바일 시트가 동시에 마운트되는 구조라 함께 갱신돼야 한다. */
    it('같은 상태를 쓰는 두 인스턴스가 함께 전환된다', () => {
        render(
            <NextIntlClientProvider locale="ko" messages={messages}>
                <PlainAnalysisSwitch plain={PLAIN}>
                    <div>패널 원본</div>
                </PlainAnalysisSwitch>
                <PlainAnalysisSwitch plain={PLAIN}>
                    <div>시트 원본</div>
                </PlainAnalysisSwitch>
            </NextIntlClientProvider>
        );
        fireEvent.click(screen.getAllByRole('radio', { name: T.raw })[0]);
        expect(screen.getByText('패널 원본')).toBeInTheDocument();
        expect(screen.getByText('시트 원본')).toBeInTheDocument();
    });

    it('renderToggle을 주면 토글 배치를 호출부에 위임한다', () => {
        render(
            <NextIntlClientProvider locale="ko" messages={messages}>
                <PlainAnalysisSwitch
                    plain={PLAIN}
                    renderToggle={toggle => (
                        <header data-testid="custom-header">{toggle}</header>
                    )}
                >
                    <div>{RAW}</div>
                </PlainAnalysisSwitch>
            </NextIntlClientProvider>
        );
        expect(
            screen
                .getByTestId('custom-header')
                .querySelector('[role="radiogroup"]')
        ).not.toBeNull();
    });

    it('hasLockedDetails를 산문 뷰로 전달한다', () => {
        renderSwitch({ hasLockedDetails: true });
        expect(screen.getByText(T.lockedNotice)).toBeInTheDocument();
        expect(screen.getByRole('link', { name: T.lockedCta })).toHaveAttribute(
            'href',
            expect.stringContaining('signup')
        );
    });

    it('잠긴 정보가 없으면 안내와 가입 링크를 렌더하지 않는다', () => {
        renderSwitch({ hasLockedDetails: false });
        expect(screen.queryByText(T.lockedNotice)).not.toBeInTheDocument();
        expect(
            screen.queryByRole('link', { name: T.lockedCta })
        ).not.toBeInTheDocument();
    });
});

/**
 * 쉽게보기는 `AnalysisPanel` 안쪽만 감싼다. 같은 페이지의 SSR 스냅샷 산문
 * (`data-snapshot-prose`)에는 전문 용어가 그대로 들어 있어, 함께 감추지 않으면
 * 쉽게보기를 켠 사람이 절반만 쉬운 화면을 보게 된다(실증으로 확인한 결함).
 *
 * 숨김은 CSS가 하고, 이 컴포넌트는 루트 속성만 세운다 — 그 섹션은 SEO 자산이라
 * DOM에서 지우면 안 된다.
 */
describe('스냅샷 산문 연동', () => {
    afterEach(() => {
        delete document.documentElement.dataset.analysisView;
    });

    it('평이화가 있고 쉽게보기일 때 루트에 표식을 세운다', () => {
        render(
            <PlainAnalysisSwitch
                plain="쉽게 쓴 분석문입니다."
                hasLockedDetails={false}
            >
                <p>원본</p>
            </PlainAnalysisSwitch>
        );

        expect(document.documentElement.dataset.analysisView).toBe('plain');
    });

    /**
     * 평이화가 없으면(가드 실패·봇 요청) 토글 자체가 없고 원본만 나온다. 그때
     * 표식을 세우면 스냅샷까지 사라져 **화면에서 내용이 통째로 줄어든다.**
     * 봇에게 SEO 자산이 숨겨지는 경로도 이 조건이 막는다.
     */
    it('평이화가 없으면 표식을 세우지 않는다', () => {
        render(
            <PlainAnalysisSwitch plain={null} hasLockedDetails={false}>
                <p>원본</p>
            </PlainAnalysisSwitch>
        );

        expect(document.documentElement.dataset.analysisView).toBeUndefined();
    });

    it('언마운트하면 표식을 걷는다', () => {
        const view = render(
            <PlainAnalysisSwitch
                plain="쉽게 쓴 분석문입니다."
                hasLockedDetails={false}
            >
                <p>원본</p>
            </PlainAnalysisSwitch>
        );
        expect(document.documentElement.dataset.analysisView).toBe('plain');

        view.unmount();
        expect(document.documentElement.dataset.analysisView).toBeUndefined();
    });
});

/**
 * 프리웜이 아직 닿지 않은 종목·탭에는 평이화가 없다. 그때는 토글도 표식도 없이
 * 원문만 나와야 한다 — 표식을 세우면 스냅샷이 숨겨져 화면이 통째로 비고, 토글을
 * 띄우면 누를 때마다 빈 화면이 된다.
 */
describe('평이화가 없을 때 원문으로 떨어진다', () => {
    afterEach(() => {
        delete document.documentElement.dataset.analysisView;
    });

    it.each([
        ['null', null],
        ['undefined', undefined],
        ['빈 문자열', ''],
        ['공백만', '   \n  '],
    ])('%s이면 원문을 그대로 보여준다', (_label, plain) => {
        render(
            <PlainAnalysisSwitch plain={plain} hasLockedDetails={false}>
                <p>원본 본문</p>
            </PlainAnalysisSwitch>
        );

        expect(screen.getByText('원본 본문')).toBeInTheDocument();
        expect(screen.queryByRole('radiogroup')).toBeNull();
        expect(document.documentElement.dataset.analysisView).toBeUndefined();
    });
});
