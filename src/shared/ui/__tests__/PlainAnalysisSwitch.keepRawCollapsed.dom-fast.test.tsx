/**
 * `PlainAnalysisSwitch`의 `keepRawCollapsed` — 쉽게보기여도 전문가 원문을 닫힌
 * `<details>` 안에 남기는 SSR 스냅샷 전용 모드.
 *
 * 이 모드가 깨지면 둘 중 하나가 조용히 일어난다: 원문이 SSR HTML에서 빠지거나(색인 손실),
 * 라이브 위젯까지 원문을 두 벌 마운트한다(스크린리더 중복). 둘 다 화면만 봐서는 안 보인다.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { NextIntlClientProvider } from 'next-intl';
import messages from '../../../../messages/ko.json';
import { PlainAnalysisSwitch } from '../PlainAnalysisSwitch';

const T = messages.widgets.analysis.viewToggle;
const RAW = '전문가 원문: RSI 다이버전스와 볼린저 상단 이탈';
const PLAIN = '쉽게 쓴 첫 문단입니다.';

function renderSwitch(
    props: Partial<Parameters<typeof PlainAnalysisSwitch>[0]> = {}
) {
    return render(
        <NextIntlClientProvider locale="ko" messages={messages}>
            <PlainAnalysisSwitch plain={PLAIN} {...props}>
                <p>{RAW}</p>
            </PlainAnalysisSwitch>
        </NextIntlClientProvider>
    );
}

function rawDisclosure(): HTMLDetailsElement | null {
    return document.querySelector('details');
}

beforeEach(() => {
    window.localStorage.clear();
});

describe('PlainAnalysisSwitch keepRawCollapsed', () => {
    describe('prop이 있을 때(쉽게보기)', () => {
        it('평이화와 함께 닫힌 <details>를 그리고, 원문은 그 안의 DOM에 남는다', () => {
            renderSwitch({ keepRawCollapsed: true });

            expect(screen.getByText(PLAIN)).toBeInTheDocument();
            const details = rawDisclosure();
            expect(details).not.toBeNull();
            expect(details?.open).toBe(false);
            // 닫혀 있어도 원문 텍스트는 DOM에 있다(SSR HTML에 실린다).
            expect(details).toHaveTextContent(RAW);
        });

        it('요약 줄은 카탈로그 문구·44px 터치 타깃·포커스 링을 갖는다', () => {
            renderSwitch({ keepRawCollapsed: true });

            const summary = rawDisclosure()?.querySelector('summary');
            expect(summary).toHaveTextContent(T.rawDisclosure);
            expect(T.rawDisclosure).toBe('전문가 분석 원문 펼쳐 보기');
            expect(summary).toHaveClass('min-h-11');
            expect(summary).toHaveClass('focus-visible:ring-2');
        });

        it('닫혀 있으면 +, 열리면 −를 보인다(group-open으로 전환)', () => {
            renderSwitch({ keepRawCollapsed: true });

            const summary = rawDisclosure()?.querySelector('summary');
            const plus = [
                ...(summary?.querySelectorAll('span span') ?? []),
            ].find(el => el.textContent === '+');
            const minus = [
                ...(summary?.querySelectorAll('span span') ?? []),
            ].find(el => el.textContent === '−');
            expect(plus).toHaveClass('group-open:hidden');
            expect(minus).toHaveClass('hidden', 'group-open:inline');
            expect(rawDisclosure()).toHaveClass('group');
        });

        it('요약 줄을 누르면 펼쳐진다', () => {
            renderSwitch({ keepRawCollapsed: true });

            const details = rawDisclosure();
            const summary = details?.querySelector('summary');
            if (summary === null || summary === undefined) {
                throw new Error('summary missing');
            }
            fireEvent.click(summary);
            expect(details?.open).toBe(true);
        });
    });

    it('prop이 없으면 쉽게보기에서 원문을 마운트하지 않는다(라이브 위젯 기본)', () => {
        renderSwitch();

        expect(screen.getByText(PLAIN)).toBeInTheDocument();
        expect(screen.queryByText(RAW)).not.toBeInTheDocument();
        expect(rawDisclosure()).toBeNull();
    });

    it('원본 모드에서는 원문을 그대로 그리고 접기를 두지 않는다', () => {
        renderSwitch({ keepRawCollapsed: true });
        fireEvent.click(screen.getByRole('radio', { name: T.raw }));

        expect(screen.getByText(RAW)).toBeInTheDocument();
        expect(rawDisclosure()).toBeNull();
        expect(screen.queryByText(PLAIN)).not.toBeInTheDocument();
    });
});
