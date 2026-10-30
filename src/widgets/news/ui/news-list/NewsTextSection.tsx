/**
 * 카드 안의 라벨 달린 본문 블록(본문·요약 공용).
 */
interface NewsTextSectionProps {
    label: string;
    text: string;
}

/** 구분선 + 소제목 + 문단. */
export function NewsTextSection({ label, text }: NewsTextSectionProps) {
    return (
        <section className="mt-3 border-t border-secondary-700/70 pt-3">
            <h4 className="mb-1 text-xs font-medium text-secondary-300">
                {label}
            </h4>
            <p className="text-sm leading-relaxed wrap-break-word text-secondary-400">
                {text}
            </p>
        </section>
    );
}
