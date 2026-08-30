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
