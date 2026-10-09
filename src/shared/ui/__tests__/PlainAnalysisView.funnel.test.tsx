import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import messages from '../../../../messages/ko.json';

const track = vi.hoisted(() => vi.fn());
vi.mock('@/shared/lib/funnel/trackFunnelEvent', () => ({
    trackFunnelEvent: track,
}));
vi.mock('next/link', () => ({
    default: ({
        href,
        children,
        ...rest
    }: {
        href: string;
        children: React.ReactNode;
        [key: string]: unknown;
    }) => (
        <a href={href} {...rest}>
            {children}
        </a>
    ),
}));

import { PlainAnalysisView } from '@/shared/ui/PlainAnalysisView';

describe('PlainAnalysisView 퍼널 이벤트', () => {
    beforeEach(() => {
        track.mockReset();
    });

    it('잠긴 상세 안내의 가입 CTA 클릭은 gate_clicked{locked_detail}을 보낸다', () => {
        render(
            <PlainAnalysisView
                text="첫 문단입니다."
                hasLockedDetails
                onShowRaw={vi.fn()}
            />
        );
        fireEvent.click(
            screen.getByRole('link', {
                name: messages.widgets.analysis.viewToggle.lockedCta,
            })
        );
        expect(track).toHaveBeenCalledWith('gate_clicked', {
            gate: 'locked_detail',
        });
    });

    it('원본보기 전환은 기록하지 않는다', () => {
        render(
            <PlainAnalysisView
                text="첫 문단입니다."
                hasLockedDetails
                onShowRaw={vi.fn()}
            />
        );
        fireEvent.click(
            screen.getByRole('button', {
                name: messages.widgets.analysis.viewToggle.cta,
            })
        );
        expect(track).not.toHaveBeenCalled();
    });
});
