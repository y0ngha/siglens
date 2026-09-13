import { Geist, Geist_Mono } from 'next/font/google';
import localFont from 'next/font/local';

/**
 * 두 루트 레이아웃(`[locale]/layout.tsx`, `ai/[locale]/layout.tsx`)이 **같은**
 * 폰트 변수를 `<html>`에 싣도록 한 곳에서 정의한다. 따로 두었을 때 ai 호스트에만
 * `Geist_Mono`가 빠져 `--font-geist-mono`가 비었고, 헤더 로고·AI 워드마크처럼
 * `font-mono`를 쓰는 글자가 브라우저 기본 고정폭으로 떨어져 두 호스트의 헤더
 * 글꼴이 달라 보였다(2026-09-13 사용자 제보).
 */

// Geist는 라틴만 지원하므로 한글 글리프는 globals.css의 --font-sans 스택에서
// 자동으로 Pretendard Variable로 fallback된다. 한글 OS 폰트 의존을 끊어
// 디바이스 간 typography 일관성과 한글 CLS를 개선한다.
const geistSans = Geist({
    variable: '--font-geist-sans',
    subsets: ['latin'],
});

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
const pretendard = localFont({
    src: './fonts/PretendardVariable-subset.woff2',
    variable: '--font-pretendard',
    display: 'swap',
    weight: '100 900',
});

/** `<html className>`에 붙이는 폰트 CSS 변수 클래스 묶음. */
export const FONT_VARIABLE_CLASSES = `${geistSans.variable} ${geistMono.variable} ${pretendard.variable}`;
