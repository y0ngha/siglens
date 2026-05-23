interface HeroIllustrationProps {
    readonly className?: string;
}

/** SVG candle 좌표/색상 정의. wick은 (cx, wickY1)–(cx, wickY2) 선분, body는 cx 기준 ±10폭의 rect. */
interface Candle {
    readonly cx: number;
    readonly wickY1: number;
    readonly wickY2: number;
    readonly bodyY: number;
    readonly bodyH: number;
    readonly bullish: boolean;
}

const CANDLE_BULL = '#3b82f6';
const CANDLE_BEAR = '#fb7185';
const CANDLE_HALF_WIDTH = 10;
const CANDLE_BODY_WIDTH = CANDLE_HALF_WIDTH * 2;

const CANDLES: ReadonlyArray<Candle> = [
    { cx: 70, wickY1: 285, wickY2: 320, bodyY: 295, bodyH: 20, bullish: true },
    { cx: 112, wickY1: 270, wickY2: 305, bodyY: 280, bodyH: 20, bullish: true },
    {
        cx: 154,
        wickY1: 265,
        wickY2: 300,
        bodyY: 275,
        bodyH: 20,
        bullish: false,
    },
    { cx: 196, wickY1: 258, wickY2: 290, bodyY: 268, bodyH: 20, bullish: true },
    // 5: bull strong — body height 26
    { cx: 238, wickY1: 240, wickY2: 280, bodyY: 248, bodyH: 26, bullish: true },
    { cx: 280, wickY1: 230, wickY2: 262, bodyY: 238, bodyH: 20, bullish: true },
    {
        cx: 322,
        wickY1: 225,
        wickY2: 258,
        bodyY: 232,
        bodyH: 20,
        bullish: false,
    },
    // 8: bull strong + cross point — body height 32 (골든크로스 마커 위치)
    { cx: 364, wickY1: 215, wickY2: 255, bodyY: 218, bodyH: 32, bullish: true },
    { cx: 406, wickY1: 205, wickY2: 235, bodyY: 208, bodyH: 22, bullish: true },
    { cx: 448, wickY1: 195, wickY2: 222, bodyY: 198, bodyH: 20, bullish: true },
    { cx: 490, wickY1: 185, wickY2: 212, bodyY: 188, bodyH: 20, bullish: true },
    {
        cx: 532,
        wickY1: 180,
        wickY2: 208,
        bodyY: 183,
        bodyH: 20,
        bullish: false,
    },
    { cx: 574, wickY1: 175, wickY2: 200, bodyY: 178, bodyH: 17, bullish: true },
    { cx: 616, wickY1: 170, wickY2: 194, bodyY: 172, bodyH: 18, bullish: true },
    { cx: 658, wickY1: 165, wickY2: 188, bodyY: 167, bodyH: 17, bullish: true },
    { cx: 700, wickY1: 160, wickY2: 184, bodyY: 162, bodyH: 18, bullish: true },
];

/**
 * Hero 영역 LCP 최적화용 인라인 SVG 일러스트.
 *
 * 텍스트 H1이 LCP가 되면 폰트 로드에 LCP가 묶여 측정 변동성이 크다. 결정적이고
 * 큰 시각 요소(이 SVG)를 above-the-fold에 배치해 LCP 후보를 옮긴다. 인라인 SVG는
 * 추가 fetch가 없어 HTML 파싱 즉시 페인트되고, preload·priority hint 없이도 LCP
 * 안정성이 높다.
 *
 * Siglens 핵심 시각 컨셉(캔들 차트 + MA 추세 + 신호 마커 + RSI 서브패널)을
 * 추상화한 결정적 디자인이라 실제 데이터에 의존하지 않고 시간이 지나도 outdate
 * 되지 않는다. 모든 좌표·색상은 viewBox(800×500) 내 SVG primitive로 고정한다.
 *
 * 색상은 Tailwind palette hex를 직접 박는다. SVG presentation attribute도
 * `var(--color-primary-500)` 같은 CSS 변수를 받을 수 있지만, 이 illustration은
 * brand color 변경의 영향을 받지 않는 정적 시각 자산이라는 의도로 hex를 그대로
 * 유지한다. dark-only 사이트라 light variant 분기도 불필요.
 */
export function HeroIllustration({ className }: HeroIllustrationProps) {
    return (
        <svg
            viewBox="0 0 800 500"
            xmlns="http://www.w3.org/2000/svg"
            role="img"
            aria-label="캔들 차트와 보조지표 추세선, 골든크로스 신호 마커, RSI 서브패널이 표시된 분석 대시보드 일러스트"
            className={className}
            preserveAspectRatio="xMidYMid meet"
        >
            <defs>
                <linearGradient id="hero-bg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#1e293b" />
                    <stop offset="1" stopColor="#0f172a" />
                </linearGradient>
                <linearGradient id="hero-ma" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0" stopColor="#60a5fa" stopOpacity="0.65" />
                    <stop offset="0.5" stopColor="#93c5fd" />
                    <stop offset="1" stopColor="#60a5fa" stopOpacity="0.65" />
                </linearGradient>
                <linearGradient id="hero-area" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#3b82f6" stopOpacity="0.28" />
                    <stop offset="1" stopColor="#3b82f6" stopOpacity="0" />
                </linearGradient>
            </defs>

            {/* 프레임 */}
            <rect
                x="0"
                y="0"
                width="800"
                height="500"
                rx="24"
                fill="url(#hero-bg)"
            />
            <rect
                x="0.5"
                y="0.5"
                width="799"
                height="499"
                rx="23.5"
                fill="none"
                stroke="#334155"
                strokeWidth="1"
            />

            {/* 좌상단 ticker chip */}
            <rect
                x="32"
                y="32"
                width="160"
                height="34"
                rx="17"
                fill="#172554"
                stroke="#1d4ed8"
            />
            <circle cx="52" cy="49" r="5" fill="#3b82f6" />
            <text
                x="68"
                y="54"
                fontFamily="ui-monospace, SFMono-Regular, monospace"
                fontSize="14"
                fill="#93c5fd"
                fontWeight="600"
            >
                AAPL
            </text>
            <text
                x="118"
                y="54"
                fontFamily="ui-monospace, SFMono-Regular, monospace"
                fontSize="11"
                fill="#94a3b8"
            >
                DAILY · 1Y
            </text>

            {/* 우상단 가격 + 변화율 */}
            <text
                x="768"
                y="52"
                textAnchor="end"
                fontFamily="ui-monospace, SFMono-Regular, monospace"
                fontSize="22"
                fill="#e2e8f0"
                fontWeight="700"
            >
                232.41
            </text>
            <text
                x="768"
                y="70"
                textAnchor="end"
                fontFamily="ui-monospace, SFMono-Regular, monospace"
                fontSize="11"
                fill="#34d399"
                fontWeight="600"
            >
                +1.82% (+4.16)
            </text>

            {/* 메인 차트 영역 grid (faint dashed) */}
            <line
                x1="32"
                y1="180"
                x2="768"
                y2="180"
                stroke="#1e293b"
                strokeDasharray="4 4"
            />
            <line
                x1="32"
                y1="260"
                x2="768"
                y2="260"
                stroke="#1e293b"
                strokeDasharray="4 4"
            />
            <line
                x1="32"
                y1="340"
                x2="768"
                y2="340"
                stroke="#1e293b"
                strokeDasharray="4 4"
            />

            {/* MA 채움 area */}
            <path
                d="M 50 290 Q 130 260 200 245 T 350 205 T 520 180 T 720 158 L 720 380 L 50 380 Z"
                fill="url(#hero-area)"
            />

            {/* MA 라인 */}
            <path
                d="M 50 290 Q 130 260 200 245 T 350 205 T 520 180 T 720 158"
                fill="none"
                stroke="url(#hero-ma)"
                strokeWidth="2.5"
                strokeLinecap="round"
            />

            {/* 캔들 16개 — bull(primary-500) / bear(rose-400) 혼합, 상승 추세.
                좌표/색은 CANDLES 데이터로 분리해 wick(line) + body(rect) 한 쌍씩 map. */}
            <g strokeLinecap="round">
                {CANDLES.map(c => {
                    const color = c.bullish ? CANDLE_BULL : CANDLE_BEAR;
                    return (
                        <g key={c.cx}>
                            <line
                                x1={c.cx}
                                y1={c.wickY1}
                                x2={c.cx}
                                y2={c.wickY2}
                                stroke={color}
                                strokeWidth="1.5"
                            />
                            <rect
                                x={c.cx - CANDLE_HALF_WIDTH}
                                y={c.bodyY}
                                width={CANDLE_BODY_WIDTH}
                                height={c.bodyH}
                                fill={color}
                            />
                        </g>
                    );
                })}
            </g>

            {/* 골든크로스 신호 마커 (캔들 8 위치) */}
            <circle
                cx="364"
                cy="215"
                r="11"
                fill="none"
                stroke="#fbbf24"
                strokeWidth="2"
            />
            <circle cx="364" cy="215" r="3" fill="#fbbf24" />

            {/* 신호 라벨 chip */}
            <g transform="translate(382, 196)">
                <rect
                    x="0"
                    y="0"
                    width="110"
                    height="26"
                    rx="6"
                    fill="#0c1326"
                    stroke="#1d4ed8"
                />
                <text
                    x="12"
                    y="17"
                    fontFamily="ui-monospace, SFMono-Regular, monospace"
                    fontSize="11"
                    fill="#fbbf24"
                    fontWeight="700"
                >
                    ▲
                </text>
                <text
                    x="28"
                    y="17"
                    fontFamily="ui-monospace, SFMono-Regular, monospace"
                    fontSize="11"
                    fill="#cbd5e1"
                >
                    GoldenCross
                </text>
            </g>

            {/* 가격 우측 라벨 dashed line */}
            <line
                x1="710"
                y1="158"
                x2="768"
                y2="158"
                stroke="#3b82f6"
                strokeDasharray="3 3"
                strokeOpacity="0.5"
            />
            <rect
                x="744"
                y="148"
                width="32"
                height="20"
                rx="3"
                fill="#1e293b"
                stroke="#3b82f6"
            />
            <text
                x="760"
                y="162"
                textAnchor="middle"
                fontFamily="ui-monospace, SFMono-Regular, monospace"
                fontSize="10"
                fill="#93c5fd"
                fontWeight="600"
            >
                MA
            </text>

            {/* 서브패널 구분선 */}
            <line x1="32" y1="400" x2="768" y2="400" stroke="#1e293b" />

            {/* RSI 서브패널 */}
            <text
                x="48"
                y="424"
                fontFamily="ui-monospace, SFMono-Regular, monospace"
                fontSize="11"
                fill="#64748b"
                fontWeight="600"
            >
                RSI 14
            </text>
            <text
                x="100"
                y="424"
                fontFamily="ui-monospace, SFMono-Regular, monospace"
                fontSize="11"
                fill="#a78bfa"
                fontWeight="600"
            >
                62.4
            </text>
            {/* RSI 70/30 reference */}
            <line
                x1="120"
                y1="430"
                x2="760"
                y2="430"
                stroke="#1e293b"
                strokeDasharray="2 4"
            />
            <line
                x1="120"
                y1="465"
                x2="760"
                y2="465"
                stroke="#1e293b"
                strokeDasharray="2 4"
            />
            {/* RSI 곡선 */}
            <path
                d="M 120 458 Q 200 450 280 440 T 440 432 T 600 422 T 760 416"
                fill="none"
                stroke="#a78bfa"
                strokeWidth="1.8"
                strokeLinecap="round"
            />
        </svg>
    );
}
