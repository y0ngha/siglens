import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ModelSelect } from '@/widgets/chat/ModelSelect';
import type { ModelOption } from '@/widgets/chat/ModelSelect';
import type { ModelId } from '@y0ngha/siglens-core';

// isFreeModel: 'free-model'은 무료, 나머지는 유료로 처리한다.
vi.mock('@y0ngha/siglens-core', async actual => {
    const mod = await actual<typeof import('@y0ngha/siglens-core')>();
    return {
        ...mod,
        isFreeModel: (id: ModelId) => id === ('free-model' as ModelId),
    };
});

const OPTIONS: ModelOption[] = [
    {
        id: 'gemini-2.5-flash' as ModelId,
        label: 'Flash',
        fullName: 'Gemini 2.5 Flash',
    },
    {
        id: 'claude-sonnet-4-6' as ModelId,
        label: 'Sonnet',
        fullName: 'Claude Sonnet 4.6',
    },
];

describe('ModelSelect', () => {
    it('hydration 전에는 스켈레톤을 렌더하고 버튼을 노출하지 않는다', () => {
        render(
            <ModelSelect
                options={OPTIONS}
                selected={'gemini-2.5-flash' as ModelId}
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
                options={OPTIONS}
                selected={'gemini-2.5-flash' as ModelId}
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
                options={OPTIONS}
                selected={'gemini-2.5-flash' as ModelId}
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
                options={OPTIONS}
                selected={'gemini-2.5-flash' as ModelId}
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
                options={OPTIONS}
                selected={'gemini-2.5-flash' as ModelId}
                onChange={onChange}
                isHydrated={true}
            />
        );
        fireEvent.click(screen.getByRole('button', { name: 'AI 모델 선택' }));

        const opts = screen.getAllByRole('option');
        fireEvent.click(opts[1]!);

        expect(onChange).toHaveBeenCalledWith('claude-sonnet-4-6');
        expect(screen.queryByRole('listbox')).toBeNull();
    });

    it('유료 모델에 PRO 배지, 무료 모델에는 배지 없음', () => {
        const optionsWithFree: ModelOption[] = [
            {
                id: 'free-model' as ModelId,
                label: 'Free',
                fullName: 'Free Model',
            },
            {
                id: 'claude-sonnet-4-6' as ModelId,
                label: 'Sonnet',
                fullName: 'Claude Sonnet 4.6',
            },
        ];
        render(
            <ModelSelect
                options={optionsWithFree}
                selected={'free-model' as ModelId}
                onChange={vi.fn()}
                isHydrated={true}
            />
        );
        fireEvent.click(screen.getByRole('button', { name: 'AI 모델 선택' }));

        const opts = screen.getAllByRole('option');
        // 무료 모델에는 PRO 텍스트 없음
        expect(opts[0]!.textContent).not.toContain('PRO');
        // 유료 모델에는 PRO 배지
        expect(opts[1]!.textContent).toContain('PRO');
    });

    it('Escape 키로 listbox를 닫는다', () => {
        render(
            <ModelSelect
                options={OPTIONS}
                selected={'gemini-2.5-flash' as ModelId}
                onChange={vi.fn()}
                isHydrated={true}
            />
        );
        fireEvent.click(screen.getByRole('button', { name: 'AI 모델 선택' }));
        expect(screen.getByRole('listbox')).toBeDefined();

        fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Escape' });
        expect(screen.queryByRole('listbox')).toBeNull();
    });
});
