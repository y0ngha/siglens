import { MarkdownText } from '@/shared/ui/MarkdownText';

interface IntegratedConclusionProps {
    text: string;
}

// 통합 결론은 네 axis(technical/options/fundamental/news)를 묶어 한 페이지의
// 최종 결론을 제시하는 focal section이다. 시각적으로도 sibling axis summary와
// 구분되도록 primary tone의 border + 배경을 사용한다.
export function IntegratedConclusion({ text }: IntegratedConclusionProps) {
    if (!text) return null;
    return (
        <section
            aria-labelledby="overall-integrated-conclusion-heading"
            className="border-primary-500/30 bg-primary-600/5 rounded-xl border p-6"
        >
            <h2
                id="overall-integrated-conclusion-heading"
                className="mb-3 text-lg font-semibold text-balance"
            >
                통합 결론
            </h2>
            <MarkdownText className="text-sm">{text}</MarkdownText>
        </section>
    );
}
