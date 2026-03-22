import { ClaudeProvider } from '@/infrastructure/ai/claude';

describe('ClaudeProvider', () => {
    let provider: ClaudeProvider;

    beforeEach(() => {
        provider = new ClaudeProvider();
    });

    describe('정상 입력으로 analyze를 호출하면', () => {
        it('AnalysisResponse 형태의 값을 반환한다', async () => {
            const result = await provider.analyze('test prompt');

            expect(result).toHaveProperty('summary');
            expect(result).toHaveProperty('trend');
            expect(result).toHaveProperty('signals');
            expect(result).toHaveProperty('skillSignals');
            expect(result).toHaveProperty('riskLevel');
            expect(result).toHaveProperty('keyLevels');
            expect(result.keyLevels).toHaveProperty('support');
            expect(result.keyLevels).toHaveProperty('resistance');
        });

        it('trend는 bullish | bearish | neutral 중 하나다', async () => {
            const result = await provider.analyze('test prompt');

            expect(['bullish', 'bearish', 'neutral']).toContain(result.trend);
        });

        it('riskLevel은 low | medium | high 중 하나다', async () => {
            const result = await provider.analyze('test prompt');

            expect(['low', 'medium', 'high']).toContain(result.riskLevel);
        });

        it('signals는 배열을 반환한다', async () => {
            const result = await provider.analyze('test prompt');

            expect(Array.isArray(result.signals)).toBe(true);
        });

        it('skillSignals는 배열을 반환한다', async () => {
            const result = await provider.analyze('test prompt');

            expect(Array.isArray(result.skillSignals)).toBe(true);
        });

        it('keyLevels.support와 keyLevels.resistance는 배열을 반환한다', async () => {
            const result = await provider.analyze('test prompt');

            expect(Array.isArray(result.keyLevels.support)).toBe(true);
            expect(Array.isArray(result.keyLevels.resistance)).toBe(true);
        });
    });
});
