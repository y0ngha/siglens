/**
 * The in-body investment disclaimer both landing pages end with.
 */
import { cn } from '@/shared/lib/cn';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';

/** Body disclaimer block shared by both landing pages. */
export function LpDisclaimer() {
    return (
        <section
            aria-label="투자 유의사항"
            className={cn(
                SURFACE_CARD,
                'mt-16 px-5 py-4 text-sm leading-6 text-secondary-400'
            )}
        >
            시그렌즈가 보여주는 분석과 답변은 공개 데이터를 정리한 참고 자료이며
            특정 종목의 매수나 매도를 권유하지 않습니다. 투자 판단과 그 결과는
            투자자 본인에게 있습니다.
        </section>
    );
}
