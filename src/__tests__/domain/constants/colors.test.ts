import { CHART_COLORS, getPeriodColor } from '@/domain/constants/colors';

describe('CHART_COLORS', () => {
    describe('차트 배경 / 그리드 / 텍스트 컬러', () => {
        it('background는 네이비(#0f172a)이다', () => {
            expect(CHART_COLORS.background).toBe('#0f172a');
        });

        it('grid는 다크 슬레이트(#1e293b)이다', () => {
            expect(CHART_COLORS.grid).toBe('#1e293b');
        });

        it('text는 슬레이트(#94a3b8)이다', () => {
            expect(CHART_COLORS.text).toBe('#94a3b8');
        });
    });

    describe('상승/하락/중립 컬러', () => {
        it('bullish는 틸 그린(#26a69a)이다', () => {
            expect(CHART_COLORS.bullish).toBe('#26a69a');
        });

        it('bearish는 레드(#ef5350)이다', () => {
            expect(CHART_COLORS.bearish).toBe('#ef5350');
        });

        it('neutral은 슬레이트(#94a3b8)이다', () => {
            expect(CHART_COLORS.neutral).toBe('#94a3b8');
        });
    });

    describe('거래량 컬러', () => {
        it('volumeBullish는 50% 투명도 틸 그린(#26a69a80)이다', () => {
            expect(CHART_COLORS.volumeBullish).toBe('#26a69a80');
        });

        it('volumeBearish는 50% 투명도 레드(#ef535080)이다', () => {
            expect(CHART_COLORS.volumeBearish).toBe('#ef535080');
        });
    });

    describe('MA/EMA 기간별 컬러', () => {
        it('period5는 레드(#ef4444)이다', () => {
            expect(CHART_COLORS.period5).toBe('#ef4444');
        });

        it('period10은 오렌지(#f97316)이다', () => {
            expect(CHART_COLORS.period10).toBe('#f97316');
        });

        it('period20은 옐로우(#eab308)이다', () => {
            expect(CHART_COLORS.period20).toBe('#eab308');
        });

        it('period60은 그린(#22c55e)이다', () => {
            expect(CHART_COLORS.period60).toBe('#22c55e');
        });

        it('period120은 블루(#3b82f6)이다', () => {
            expect(CHART_COLORS.period120).toBe('#3b82f6');
        });

        it('period200은 퍼플(#a855f7)이다', () => {
            expect(CHART_COLORS.period200).toBe('#a855f7');
        });
    });

    describe('볼린저 밴드 컬러', () => {
        it('bollingerUpper는 인디고(#818cf8)이다', () => {
            expect(CHART_COLORS.bollingerUpper).toBe('#818cf8');
        });

        it('bollingerMiddle은 슬레이트(#94a3b8)이다', () => {
            expect(CHART_COLORS.bollingerMiddle).toBe('#94a3b8');
        });

        it('bollingerLower는 인디고(#818cf8)이다', () => {
            expect(CHART_COLORS.bollingerLower).toBe('#818cf8');
        });

        it('bollingerBackground는 12% 투명도 인디고(#818cf820)이다', () => {
            expect(CHART_COLORS.bollingerBackground).toBe('#818cf820');
        });
    });

    describe('MACD 컬러', () => {
        it('macdLine은 블루(#3b82f6)이다', () => {
            expect(CHART_COLORS.macdLine).toBe('#3b82f6');
        });

        it('macdSignal은 앰버(#f59e0b)이다', () => {
            expect(CHART_COLORS.macdSignal).toBe('#f59e0b');
        });

        it('macdHistogramBullish는 틸 그린(#26a69a)이다', () => {
            expect(CHART_COLORS.macdHistogramBullish).toBe('#26a69a');
        });

        it('macdHistogramBearish는 레드(#ef5350)이다', () => {
            expect(CHART_COLORS.macdHistogramBearish).toBe('#ef5350');
        });
    });

    describe('RSI 컬러', () => {
        it('rsiLine은 바이올렛(#a78bfa)이다', () => {
            expect(CHART_COLORS.rsiLine).toBe('#a78bfa');
        });

        it('rsiOverbought는 40% 투명도 레드(#ef535060)이다', () => {
            expect(CHART_COLORS.rsiOverbought).toBe('#ef535060');
        });

        it('rsiOversold는 40% 투명도 틸(#26a69a60)이다', () => {
            expect(CHART_COLORS.rsiOversold).toBe('#26a69a60');
        });
    });

    describe('DMI 컬러', () => {
        it('dmiPlus는 틸 그린(#26a69a)이다', () => {
            expect(CHART_COLORS.dmiPlus).toBe('#26a69a');
        });

        it('dmiMinus는 레드(#ef5350)이다', () => {
            expect(CHART_COLORS.dmiMinus).toBe('#ef5350');
        });

        it('dmiAdx는 앰버(#f59e0b)이다', () => {
            expect(CHART_COLORS.dmiAdx).toBe('#f59e0b');
        });
    });

    describe('VWAP 컬러', () => {
        it('vwap은 퍼플(#e879f9)이다', () => {
            expect(CHART_COLORS.vwap).toBe('#e879f9');
        });
    });

    describe('Volume Profile 컬러', () => {
        it('vpPoc는 앰버(#f59e0b)이다', () => {
            expect(CHART_COLORS.vpPoc).toBe('#f59e0b');
        });

        it('vpVah는 바이올렛(#8b5cf6)이다', () => {
            expect(CHART_COLORS.vpVah).toBe('#8b5cf6');
        });

        it('vpVal은 에메랄드(#34d399)이다', () => {
            expect(CHART_COLORS.vpVal).toBe('#34d399');
        });
    });

    describe('지지/저항선 컬러', () => {
        it('supportLine은 틸 그린(#26a69a)이다', () => {
            expect(CHART_COLORS.supportLine).toBe('#26a69a');
        });

        it('resistanceLine은 레드(#ef5350)이다', () => {
            expect(CHART_COLORS.resistanceLine).toBe('#ef5350');
        });
    });
});

describe('getPeriodColor', () => {
    describe('지원하는 기간을 전달할 때', () => {
        it('기간 5에 대해 #ef4444를 반환한다', () => {
            expect(getPeriodColor(5)).toBe('#ef4444');
        });

        it('기간 10에 대해 #f97316을 반환한다', () => {
            expect(getPeriodColor(10)).toBe('#f97316');
        });

        it('기간 20에 대해 #eab308을 반환한다', () => {
            expect(getPeriodColor(20)).toBe('#eab308');
        });

        it('기간 60에 대해 #22c55e를 반환한다', () => {
            expect(getPeriodColor(60)).toBe('#22c55e');
        });

        it('기간 120에 대해 #3b82f6을 반환한다', () => {
            expect(getPeriodColor(120)).toBe('#3b82f6');
        });

        it('기간 200에 대해 #a855f7을 반환한다', () => {
            expect(getPeriodColor(200)).toBe('#a855f7');
        });
    });

    describe('지원하지 않는 기간을 전달할 때', () => {
        it('neutral 컬러(#94a3b8)를 반환한다', () => {
            expect(getPeriodColor(999)).toBe('#94a3b8');
        });

        it('0을 전달하면 neutral 컬러를 반환한다', () => {
            expect(getPeriodColor(0)).toBe('#94a3b8');
        });
    });
});
