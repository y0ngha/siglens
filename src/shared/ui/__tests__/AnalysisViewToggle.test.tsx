import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { NextIntlClientProvider } from 'next-intl';
import messages from '../../../../messages/ko.json';
import { AnalysisViewToggle } from '../AnalysisViewToggle';

const T = messages.widgets.analysis.viewToggle;

function renderToggle(mode: 'plain' | 'raw', onChange = vi.fn()) {
    render(
        <NextIntlClientProvider locale="ko" messages={messages}>
            <AnalysisViewToggle mode={mode} onChange={onChange} />
        </NextIntlClientProvider>
    );
    return onChange;
}

describe('AnalysisViewToggle', () => {
    /**
     * 탭이 아니라 라디오다 — 두 값 중 하나를 고르는 단일 선택이고, 탭 역할을 쓰면
     * 스크린 리더가 패널 전환으로 안내해 실제 동작과 어긋난다.
     */
    it('radiogroup으로 노출된다', () => {
        renderToggle('plain');
        expect(
            screen.getByRole('radiogroup', { name: T.label })
        ).toBeInTheDocument();
        expect(screen.getAllByRole('radio')).toHaveLength(2);
    });

    it('현재 모드만 checked다', () => {
        renderToggle('plain');
        expect(screen.getByRole('radio', { name: T.plain })).toBeChecked();
        expect(screen.getByRole('radio', { name: T.raw })).not.toBeChecked();
    });

    it('원본 모드에서는 원본이 checked다', () => {
        renderToggle('raw');
        expect(screen.getByRole('radio', { name: T.raw })).toBeChecked();
    });

    it('클릭하면 해당 모드로 콜백한다', () => {
        const onChange = renderToggle('plain');
        fireEvent.click(screen.getByRole('radio', { name: T.raw }));
        expect(onChange).toHaveBeenCalledWith('raw');
    });
});

/**
 * 터치 타겟은 이 레포 표준(`min-h-11` = 44px)을 지켜야 한다.
 *
 * 예전에는 `py-1 text-xs`라 높이가 24px였다 — iOS 44pt·Android 48dp 최소치의
 * 절반이다. 시각적으로는 멀쩡해 보여서 눈으로는 잡히지 않는 종류의 결함이라
 * 클래스로 고정한다.
 */
describe('터치 타겟', () => {
    it('두 버튼 모두 44px 최소 높이를 갖는다', () => {
        render(<AnalysisViewToggle mode="plain" onChange={() => {}} />);

        const buttons = screen.getAllByRole('radio');
        expect(buttons).toHaveLength(2);
        for (const button of buttons) {
            expect(button.className).toContain('min-h-11');
        }
    });
});
