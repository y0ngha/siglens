import { escapeHtml } from '@/shared/lib/escapeHtml';
import { COLORS } from './emailTheme';

/** 줄바꿈이 있는 산문을 문단으로 나눈다(빈 줄은 버림). */
export function paragraphs(text: string): string[] {
    return text
        .split(/\n+/)
        .map(line => line.trim())
        .filter(line => line.length > 0);
}

/** 카드 안 소제목 한 줄. 라벨은 이스케이프된다. */
export function sectionTitle(label: string): string {
    return `<p style="font-size:13px;font-weight:600;color:${COLORS.heading};margin:20px 0 8px;">${escapeHtml(label)}</p>`;
}

/** 산문을 문단 `<p>`들로 바꾼다. AI가 쓴 외부 값이므로 문단마다 이스케이프한다. */
export function prose(text: string, color: string = COLORS.body): string {
    return paragraphs(text)
        .map(
            p =>
                `<p style="font-size:14px;line-height:1.65;color:${color};margin:0 0 8px;">${escapeHtml(p)}</p>`
        )
        .join('');
}
