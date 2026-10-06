import { Geist_Mono } from 'next/font/google';
import localFont from 'next/font/local';

/**
 * 두 루트 레이아웃(`[locale]/layout.tsx`, `ai/[locale]/layout.tsx`)이 **같은**
 * 폰트 변수를 `<html>`에 싣도록 한 곳에서 정의한다. 따로 두었을 때 ai 호스트에만
 * `Geist_Mono`가 빠져 `--font-geist-mono`가 비었고, 헤더 로고·AI 워드마크처럼
 * `font-mono`를 쓰는 글자가 브라우저 기본 고정폭으로 떨어져 두 호스트의 헤더
 * 글꼴이 달라 보였다(2026-09-13 사용자 제보).
 */

// 산세리프는 Pretendard 단일 폰트다(globals.css `--font-sans` 주석). 예전에는 `Geist`
// (sans)도 여기서 로드했는데 `--font-geist-sans`를 참조하는 곳이 CSS·TS 어디에도
// 남지 않은 채 **모든 페이지에서 woff2를 preload**하고 있었다(2026-10 CWV 감사) —
// 쓰지 않는 폰트가 첫 로드 대역을 Pretendard·JS와 다퉜다. 모노(`font-mono`)는
// 헤더 로고·티커·가격이 쓰므로 Geist_Mono만 남긴다.
const geistMono = Geist_Mono({
    variable: '--font-geist-mono',
    subsets: ['latin'],
});

// Pretendard Variable (subset) — self-host. next/font/local이 fingerprint URL
// + 1년 immutable Cache-Control을 자동 부여하고, fallback font(OS)와의 metric
// 을 자동 측정해 size-adjust로 CLS를 거의 0으로 만든다. third-party CDN 의존
// 없이도 dynamic-subset CDN 대비 안정성과 privacy가 우위.
//
// Subset 범위 (cmap에 포함된 실제 글리프 기준):
//  • Basic Latin / Latin-1 Supplement
//  • Hangul Compatibility Jamo (U+3130–U+318F)
//  • Hangul Syllables 중 KS X 1001 상용 음절 2,350자 (전체 U+AC00–U+D7A3가 아님)
//  • 일반 구두점 · 통화 · 위·아래 첨자 · 분수 · 수학 기호
//  • UI 글리프: 화살표(→ ↑ ↓ ←), 도형(▲ ▼ ▽ ○ ◈ ▾), ⚠, ✓ ✕ ✗, ⓘ 등 49자
// 폰트 파일은 src/app/fonts/에 colocate한다 (next/font/local 권장 패턴 — 로더를
// 이 모듈 하나에 두어 두 레이아웃이 같은 파일 URL을 공유하게 한다: dual-serving 차단).
// 원본 2.0 MB → 467 KB (-77%). 모바일 Slow 4G에서 text LCP 차단 시간을 10초
// 이상 단축한다. unicode-range 분할은 운영 복잡도 증가 대비 효과가 크지 않아
// 단일 파일을 유지한다.
//
// preload(기본값 true)를 유지하는 이유 (2026-10 CWV 감사에서 재평가):
//  • 로케일별로 끌 수 없다. next/font의 preload 링크는 **로더를 import한 레이아웃
//    모듈 단위**로 빌드 타임에 붙는다 — `[locale]/layout.tsx` 하나가 네 로케일을
//    모두 렌더하므로 런타임 locale로 분기할 자리가 없다(preload 다른 로더 두 개를
//    두어도 둘 다 import되는 순간 둘 다 preload된다).
//  • 비-ko 로케일에서도 쓰인다. `--font-sans`의 1순위라 라틴 본문도 Pretendard다.
//  • 끄면 CLS 위험이 커진다. 자동 생성되는 fallback(`adjustFontFallback` 기본값
//    'Arial')은 **라틴 글리프만** 메트릭을 맞춘다 — Arial에 한글이 없어 한글은 그
//    다음 OS 폰트로 떨어지고, 그 OS 폰트는 size-adjust가 없다. preload로 첫 페인트
//    전에 도착하면 swap 자체가 없지만, 늦게 발견되면 한글 본문이 보이는 상태에서
//    swap돼 줄바꿈이 바뀐다.
// 텍스트 LCP는 fallback 첫 페인트로 잡히므로 preload가 LCP를 늦추지 않는다.
const pretendard = localFont({
    src: './fonts/PretendardVariable-subset.woff2',
    variable: '--font-pretendard',
    display: 'swap',
    weight: '100 900',
});

/** `<html className>`에 붙이는 폰트 CSS 변수 클래스 묶음. */
export const FONT_VARIABLE_CLASSES = `${geistMono.variable} ${pretendard.variable}`;
