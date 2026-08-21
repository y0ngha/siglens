'use client';

import { useTranslations } from 'next-intl';

/**
 * 카탈로그의 문단 배열을 그대로 `<p>`로 렌더한다.
 *
 * 툴팁 본문 19개(문단 45개)가 JSX 안에 한국어로 박혀 있었다 — 모듈 스코프
 * 상수라 추출기가 보지 못했고, 네 로케일 전부 한국어로 나갔다.
 *
 * `t.raw`로 배열을 통째로 읽는다. 문단 수가 로케일마다 달라도 되고(번역가가
 * 문장을 합치거나 나눌 수 있다), 새 문단을 추가할 때 소스를 고칠 필요가 없다.
 */
export function TooltipParagraphs({
    namespace,
    tooltipKey,
}: {
    readonly namespace: string;
    readonly tooltipKey: string;
}) {
    const t = useTranslations(namespace);
    const paragraphs = t.raw(`tooltip.${tooltipKey}`) as unknown;
    if (!Array.isArray(paragraphs)) return null;
    return (
        <>
            {paragraphs.map((text: string) => (
                <p key={text}>{text}</p>
            ))}
        </>
    );
}
