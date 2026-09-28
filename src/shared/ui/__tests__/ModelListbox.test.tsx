import { fireEvent, render, screen } from '@testing-library/react';
import type { ModelId } from '@y0ngha/siglens-core';
import { ModelListbox } from '@/shared/ui/ModelListbox';

// isFreeModel: 'free-model'은 무료, 나머지는 유료로 처리한다.
vi.mock('@y0ngha/siglens-core', async actual => {
    const mod = await actual<typeof import('@y0ngha/siglens-core')>();
    return {
        ...mod,
        isFreeModel: (id: ModelId) => id === ('free-model' as ModelId),
    };
});

const MODELS = [
    'gemini-3.6-flash',
    'claude-sonnet-5',
    'claude-opus-5',
] as ModelId[];

function renderListbox(
    selected: ModelId,
    overrides: Partial<Parameters<typeof ModelListbox>[0]> = {}
) {
    const onChange = vi.fn();
    const onClose = vi.fn();
    render(
        <ModelListbox
            ref={null}
            models={MODELS}
            selected={selected}
            onChange={onChange}
            onClose={onClose}
            ariaLabel="AI 모델 목록"
            className="top-full left-0"
            {...overrides}
        />
    );
    return { onChange, onClose, listbox: screen.getByRole('listbox') };
}

describe('ModelListbox', () => {
    it('marks only the selected option as selected and tabbable', () => {
        renderListbox('claude-sonnet-5' as ModelId);
        const opts = screen.getAllByRole('option');

        expect(opts.map(o => o.getAttribute('aria-selected'))).toEqual([
            'false',
            'true',
            'false',
        ]);
        expect(opts.map(o => o.tabIndex)).toEqual([-1, 0, -1]);
        expect(opts[1]!.textContent).toContain('✓');
    });

    it('moves focus to the selected option when it opens', () => {
        renderListbox('claude-sonnet-5' as ModelId);
        expect(screen.getAllByRole('option')[1]).toHaveFocus();
    });

    it('shows each model label and full name from the display table', () => {
        renderListbox('gemini-3.6-flash' as ModelId);
        expect(screen.getByText('Flash 3.6')).toBeInTheDocument();
        expect(screen.getByText('Gemini 3.6 Flash')).toBeInTheDocument();
    });

    it.each([
        ['ArrowDown', 'gemini-3.6-flash', 'claude-sonnet-5', 1],
        ['ArrowDown', 'claude-opus-5', 'gemini-3.6-flash', 0],
        ['ArrowUp', 'claude-sonnet-5', 'gemini-3.6-flash', 0],
        ['ArrowUp', 'gemini-3.6-flash', 'claude-opus-5', 2],
        ['Home', 'claude-opus-5', 'gemini-3.6-flash', 0],
        ['End', 'gemini-3.6-flash', 'claude-opus-5', 2],
    ] as const)(
        '%s from %s selects %s and moves DOM focus to it',
        (key, from, to, index) => {
            const { onChange, onClose, listbox } = renderListbox(
                from as ModelId
            );
            fireEvent.keyDown(listbox, { key });

            expect(onChange).toHaveBeenCalledWith(to);
            expect(screen.getAllByRole('option')[index]).toHaveFocus();
            expect(onClose).not.toHaveBeenCalled();
        }
    );

    it.each(['Enter', ' '])(
        'pressing %j on an option selects it and closes',
        key => {
            const { onChange, onClose } = renderListbox(
                'gemini-3.6-flash' as ModelId
            );
            fireEvent.keyDown(screen.getAllByRole('option')[2]!, { key });

            expect(onChange).toHaveBeenCalledWith('claude-opus-5');
            expect(onClose).toHaveBeenCalledTimes(1);
        }
    );

    it('clicking an option selects it and closes', () => {
        const { onChange, onClose } = renderListbox(
            'gemini-3.6-flash' as ModelId
        );
        fireEvent.click(screen.getAllByRole('option')[1]!);

        expect(onChange).toHaveBeenCalledWith('claude-sonnet-5');
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('Escape closes without letting the key reach an outer listener', () => {
        const outer = vi.fn();
        document.addEventListener('keydown', outer);
        const { onChange, onClose, listbox } = renderListbox(
            'gemini-3.6-flash' as ModelId
        );
        fireEvent.keyDown(listbox, { key: 'Escape' });
        document.removeEventListener('keydown', outer);

        expect(onClose).toHaveBeenCalledTimes(1);
        expect(onChange).not.toHaveBeenCalled();
        expect(outer).not.toHaveBeenCalled();
    });

    it('shows the access badge per tier — member/byok, none for free', () => {
        renderListbox('free-model' as ModelId, {
            models: [
                'free-model',
                'claude-sonnet-5',
                'claude-opus-5',
            ] as ModelId[],
        });
        const opts = screen.getAllByRole('option');

        // 'free-model'은 레지스트리에 없는 ID다 — 뱃지는 조용히 생략되고,
        // 렌더가 죽지 않아야 한다(`ModelAccessBadge`의 방어 경로).
        expect(opts[0]!.textContent).not.toMatch(/MEMBER|BYOK/);
        expect(opts[1]!.textContent).toContain('MEMBER');
        expect(opts[2]!.textContent).toContain('BYOK');
    });
});
