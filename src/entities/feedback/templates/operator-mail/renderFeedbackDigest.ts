import { escapeHtml } from '@/shared/lib/escapeHtml';
import { KST_OFFSET_HOURS, MS_PER_HOUR } from '@/shared/config/time';
import type { FeedbackDigest } from '../../lib/buildFeedbackDigest';

/** 운영자 메일은 한국어 고정이다(수신자가 운영자 한 명). */
const REASON_LABEL: Readonly<Record<string, string>> = {
    inaccurate: '부정확',
    unsupported: '근거 부족',
    off_topic: '주제 이탈',
    too_long: '너무 김',
    other: '기타',
};
const SURFACE_LABEL: Readonly<Record<string, string>> = {
    siglens: 'siglens',
    siglens_ai: '시그렌즈 AI',
};

export interface RenderedFeedbackDigest {
    readonly subject: string;
    readonly text: string;
    readonly html: string;
}

function surfaceLabel(surface: string): string {
    return SURFACE_LABEL[surface] ?? surface;
}

function reasonLabels(reasons: readonly string[]): string {
    return reasons.length === 0
        ? '사유 없음'
        : reasons.map(r => REASON_LABEL[r] ?? r).join(', ');
}

/** 요약 날짜 라벨(KST `YYYY-MM-DD`). */
function kstDateLabel(at: Date): string {
    return new Date(at.getTime() + KST_OFFSET_HOURS * MS_PER_HOUR)
        .toISOString()
        .slice(0, 10);
}

/** 메일 한 줄 안에서 개행을 공백으로 접는다(의견은 사용자 입력이다). */
function oneLine(value: string): string {
    return value.replace(/\s+/g, ' ').trim();
}

function downLine(down: FeedbackDigest['downs'][number]): string {
    const where = [surfaceLabel(down.surface), down.target, down.symbol]
        .filter(Boolean)
        .join(' / ');
    const comment = down.comment ? ` — ${oneLine(down.comment)}` : '';
    return `${where} [${reasonLabels(down.reasons)}]${comment}`;
}

/**
 * 일일 요약 메일(제목·text·html)을 만든다. 사용자 입력(의견·심볼)은 HTML에서
 * 이스케이프한다. `generatedAt`은 제목의 날짜(KST)에만 쓴다.
 */
export function renderFeedbackDigest(
    digest: FeedbackDigest,
    generatedAt: Date
): RenderedFeedbackDigest {
    const date = kstDateLabel(generatedAt);
    const subject = `[SIGLENS] AI 응답 피드백 요약 ${date} (👍 ${digest.up} / 👎 ${digest.down})`;

    const textLines = [
        `지난 24시간 AI 응답 피드백: 총 ${digest.total}건 (👍 ${digest.up} / 👎 ${digest.down})`,
        '',
        '[표면·분석 종류별]',
        ...digest.groups.map(
            g =>
                `- ${surfaceLabel(g.surface)} / ${g.target}: 👍 ${g.up} / 👎 ${g.down}`
        ),
    ];
    if (digest.downs.length > 0) {
        textLines.push('', `[👎 목록 (최신순, ${digest.downs.length}건)]`);
        textLines.push(...digest.downs.map(d => `- ${downLine(d)}`));
        if (digest.omittedDowns > 0) {
            textLines.push(`- … 외 ${digest.omittedDowns}건 (DB에서 확인)`);
        }
    }
    const text = textLines.join('\n');

    const groupRows = digest.groups
        .map(
            g =>
                `<tr><td>${escapeHtml(surfaceLabel(g.surface))}</td><td>${escapeHtml(g.target)}</td><td>${g.up}</td><td>${g.down}</td></tr>`
        )
        .join('');
    const downItems = digest.downs
        .map(d => `<li>${escapeHtml(downLine(d))}</li>`)
        .join('');
    const omitted =
        digest.omittedDowns > 0
            ? `<li>… 외 ${digest.omittedDowns}건 (DB에서 확인)</li>`
            : '';
    const downSection =
        digest.downs.length > 0
            ? `<h3>👎 목록 (최신순, ${digest.downs.length}건)</h3><ul>${downItems}${omitted}</ul>`
            : '';
    const html =
        `<p>지난 24시간 AI 응답 피드백: 총 ${digest.total}건 (👍 ${digest.up} / 👎 ${digest.down})</p>` +
        `<h3>표면·분석 종류별</h3>` +
        `<table border="1" cellpadding="4" cellspacing="0"><tr><th>표면</th><th>종류</th><th>👍</th><th>👎</th></tr>${groupRows}</table>` +
        downSection;

    return { subject, text, html };
}
