import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { NextIntlClientProvider } from 'next-intl';
import messages from '../../../../messages/ko.json';
import { PlainAnalysisView } from '../PlainAnalysisView';

function renderView(
    props: Partial<Parameters<typeof PlainAnalysisView>[0]> = {}
) {
    return render(
        <NextIntlClientProvider locale="ko" messages={messages}>
            <PlainAnalysisView
                text="첫 문단입니다.\n\n둘째 문단입니다."
                hasLockedDetails={false}
                onShowRaw={vi.fn()}
                {...props}
            />
        </NextIntlClientProvider>
    );
}

describe('PlainAnalysisView', () => {
    it('빈 줄 기준으로 문단을 나눠 렌더한다', () => {
        renderView({ text: '첫 문단입니다.\n\n둘째 문단입니다.' });
        expect(screen.getByText('첫 문단입니다.')).toBeInTheDocument();
        expect(screen.getByText('둘째 문단입니다.')).toBeInTheDocument();
    });

    it('내용이 공백뿐이면 아무것도 렌더하지 않는다', () => {
        const { container } = renderView({ text: '   \n\n  ' });
        expect(container).toBeEmptyDOMElement();
    });

    /**
     * 원본 뷰는 필드별 잠금 카드로 이걸 표현하지만 쉽게보기에는 카드가 없다.
     * 안내를 빠뜨리면 무료 사용자는 잠긴 항목이 있다는 사실 자체를 알 수 없다.
     */
    it('잠긴 정보가 있으면 안내를 붙인다', () => {
        renderView({ hasLockedDetails: true });
        expect(
            screen.getByText(messages.widgets.analysis.viewToggle.lockedNotice)
        ).toBeInTheDocument();
    });

    it('잠긴 정보가 없으면 안내를 붙이지 않는다', () => {
        renderView({ hasLockedDetails: false });
        expect(
            screen.queryByText(
                messages.widgets.analysis.viewToggle.lockedNotice
            )
        ).not.toBeInTheDocument();
    });

    it('CTA를 누르면 원본 전환 콜백이 불린다', () => {
        const onShowRaw = vi.fn();
        renderView({ onShowRaw });
        fireEvent.click(
            screen.getByRole('button', {
                name: messages.widgets.analysis.viewToggle.cta,
            })
        );
        expect(onShowRaw).toHaveBeenCalledOnce();
    });

    /** 프롬프트가 마크다운을 금지한다. 렌더러를 끼우면 규칙 위반이 가려진다. */
    it('마크다운을 해석하지 않는다', () => {
        renderView({ text: `**굵게** 표시되면 안 됩니다.${'가'.repeat(5)}` });
        expect(screen.getByText(/\*\*굵게\*\*/)).toBeInTheDocument();
    });
});
