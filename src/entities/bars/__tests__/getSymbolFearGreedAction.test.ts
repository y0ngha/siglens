const { mockLoadBarsData } = vi.hoisted(() => ({ mockLoadBarsData: vi.fn() }));
vi.mock('@/entities/bars/lib/loadBarsData', () => ({
    loadBarsData: mockLoadBarsData,
}));
vi.mock('@/entities/bars/lib/symbolFearGreed', () => ({
    clientSymbolFearGreed: vi.fn(() => ({ snapshot: null, history: [] })),
}));

import { describe, expect, it, vi } from 'vitest';
import { getSymbolFearGreedAction } from '../actions/getSymbolFearGreedAction';
import { clientSymbolFearGreed } from '@/entities/bars/lib/symbolFearGreed';

describe('getSymbolFearGreedAction', () => {
    it('일봉을 서버 로더로 읽어 클라이언트용 공포·탐욕 결과로 바꿔 돌려준다', async () => {
        const data = { bars: [], indicators: {}, fearGreedBars: [] };
        mockLoadBarsData.mockResolvedValue(data);

        const result = await getSymbolFearGreedAction('NVDA', 'NVDA-FMP');

        expect(mockLoadBarsData).toHaveBeenCalledWith(
            'NVDA',
            '1Day',
            'NVDA-FMP'
        );
        expect(clientSymbolFearGreed).toHaveBeenCalledWith(data);
        expect(result).toEqual({ snapshot: null, history: [] });
    });

    it('일봉 조회 오류는 그대로 전파한다(로더가 사용자 메시지로 번역한다)', async () => {
        mockLoadBarsData.mockRejectedValue(
            new Error('시세를 불러오지 못했어요')
        );

        await expect(getSymbolFearGreedAction('NVDA')).rejects.toThrow(
            '시세를 불러오지 못했어요'
        );
    });
});
