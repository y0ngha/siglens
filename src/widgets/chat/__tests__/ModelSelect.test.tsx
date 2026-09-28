import { render, screen, fireEvent } from '@testing-library/react';
import { ModelSelect } from '@/widgets/chat/ModelSelect';
import type { ModelId } from '@y0ngha/siglens-core';

const MODELS = ['gemini-3.6-flash', 'claude-sonnet-5'] as ModelId[];

describe('ModelSelect', () => {
    it('hydration 전에는 스켈레톤을 렌더하고 버튼을 노출하지 않는다', () => {
        render(
            <ModelSelect
                models={MODELS}
                selected={'gemini-3.6-flash' as ModelId}
                onChange={vi.fn()}
                isHydrated={false}
            />
        );
        // 버튼 없이 animate-pulse 스켈레톤만 노출
        expect(screen.queryByRole('button')).toBeNull();
    });

    it('hydration 후 선택된 모델 레이블이 표시된다', () => {
        render(
            <ModelSelect
                models={MODELS}
                selected={'gemini-3.6-flash' as ModelId}
                onChange={vi.fn()}
                isHydrated={true}
            />
        );
        const trigger = screen.getByRole('button', { name: 'AI 모델 선택' });
        expect(trigger).toBeDefined();
        // 선택 레이블이 버튼 내에 노출된다
        expect(trigger.textContent).toContain('Flash');
        // 초기에는 listbox가 닫혀 있다
        expect(screen.queryByRole('listbox')).toBeNull();
    });

    it('트리거 클릭 시 listbox가 열리고 aria-haspopup/aria-expanded가 올바르다', () => {
        render(
            <ModelSelect
                models={MODELS}
                selected={'gemini-3.6-flash' as ModelId}
                onChange={vi.fn()}
                isHydrated={true}
            />
        );
        const trigger = screen.getByRole('button', { name: 'AI 모델 선택' });
        expect(trigger).toHaveAttribute('aria-haspopup', 'listbox');
        expect(trigger).toHaveAttribute('aria-expanded', 'false');

        fireEvent.click(trigger);

        expect(screen.getByRole('listbox')).toBeDefined();
        expect(trigger).toHaveAttribute('aria-expanded', 'true');
    });

    it('listbox에 role="option", aria-selected이 올바르게 설정된다', () => {
        render(
            <ModelSelect
                models={MODELS}
                selected={'gemini-3.6-flash' as ModelId}
                onChange={vi.fn()}
                isHydrated={true}
            />
        );
        fireEvent.click(screen.getByRole('button', { name: 'AI 모델 선택' }));

        const opts = screen.getAllByRole('option');
        expect(opts).toHaveLength(2);
        // 선택된 항목에 ✓ 마커와 aria-selected=true
        expect(opts[0]).toHaveAttribute('aria-selected', 'true');
        expect(opts[0]!.textContent).toContain('✓');
        expect(opts[1]).toHaveAttribute('aria-selected', 'false');
    });

    it('옵션 클릭 시 onChange가 호출되고 listbox가 닫힌다', () => {
        const onChange = vi.fn();
        render(
            <ModelSelect
                models={MODELS}
                selected={'gemini-3.6-flash' as ModelId}
                onChange={onChange}
                isHydrated={true}
            />
        );
        fireEvent.click(screen.getByRole('button', { name: 'AI 모델 선택' }));

        const opts = screen.getAllByRole('option');
        fireEvent.click(opts[1]!);

        expect(onChange).toHaveBeenCalledWith('claude-sonnet-5');
        expect(screen.queryByRole('listbox')).toBeNull();
    });

    it('Escape 키로 listbox를 닫는다', () => {
        render(
            <ModelSelect
                models={MODELS}
                selected={'gemini-3.6-flash' as ModelId}
                onChange={vi.fn()}
                isHydrated={true}
            />
        );
        fireEvent.click(screen.getByRole('button', { name: 'AI 모델 선택' }));
        expect(screen.getByRole('listbox')).toBeDefined();

        fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Escape' });
        expect(screen.queryByRole('listbox')).toBeNull();
    });

    it('옵션을 고르면 포커스를 트리거로 돌려준다', () => {
        render(
            <ModelSelect
                models={MODELS}
                selected={'gemini-3.6-flash' as ModelId}
                onChange={vi.fn()}
                isHydrated={true}
            />
        );
        const trigger = screen.getByRole('button', { name: 'AI 모델 선택' });
        fireEvent.click(trigger);
        fireEvent.click(screen.getAllByRole('option')[1]!);

        expect(trigger).toHaveFocus();
    });
});
