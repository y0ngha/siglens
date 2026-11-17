import { render, screen } from '@testing-library/react';
import { useContext } from 'react';
import { ChatChartProvider } from '@/app/ai/[locale]/_components/ChatChartProvider';
import { ChatChartSlot } from '@/widgets/agent-chat/model/chatChartSlot';

// 차트 청크는 지연 import다 — 여기서는 슬롯에 컴포넌트가 꽂히는지만 본다.
vi.mock('next/dynamic', () => ({ default: () => () => null }));

/** 슬롯에 무엇이 꽂혔는지만 본다(꽂힌 컴포넌트를 렌더하지 않는다). */
function SlotProbe() {
    const Chart = useContext(ChatChartSlot);
    return <p>{Chart === null ? 'empty' : 'filled'}</p>;
}

describe('ChatChartProvider', () => {
    it('채팅 위젯의 차트 슬롯에 지연 차트 컴포넌트를 꽂는다', () => {
        render(
            <ChatChartProvider>
                <SlotProbe />
            </ChatChartProvider>
        );
        expect(screen.getByText('filled')).toBeInTheDocument();
    });

    it('프로바이더 밖에서는 슬롯이 비어 있다', () => {
        render(<SlotProbe />);
        expect(screen.getByText('empty')).toBeInTheDocument();
    });
});
