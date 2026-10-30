/** 메일 클라이언트는 외부 CSS를 무시하므로 모든 색을 인라인 스타일에 박아 넣는다 — 그 값의 단일 출처. */
export const COLORS = {
    page: '#0f172a',
    card: '#1e293b',
    heading: '#f1f5f9',
    body: '#cbd5e1',
    muted: '#94a3b8',
    faint: '#64748b',
    link: '#60a5fa',
    rule: '#334155',
    bullish: '#26a69a',
    bearish: '#ef5350',
} as const;

/** 웹폰트를 받을 수 없으므로 시스템 글꼴 스택만 쓴다. */
export const FONT = `-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif`;
