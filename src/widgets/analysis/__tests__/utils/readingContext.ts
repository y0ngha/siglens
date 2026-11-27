import { createTranslator } from 'next-intl';
import type { Locale } from '@/shared/i18n/locales';
import { MESSAGE_CATALOGS } from '@/shared/test-utils/messageCatalogs';
import {
    formatReadingNumber,
    type ReadingRenderContext,
} from '@/widgets/analysis/utils/renderIndicatorReading';

/**
 * 해당 로케일의 **실제 카탈로그**로 만든 카드 렌더 컨텍스트. 스텁 번역자를 쓰면 키가
 * 카탈로그에서 빠져도 테스트가 통과한다.
 */
export function readingContextFor(locale: Locale): ReadingRenderContext {
    const messages = MESSAGE_CATALOGS[locale];
    const tReading = createTranslator({
        locale,
        messages,
        namespace: 'widgets.analysis.reading',
        // safe: 테스트 헬퍼는 카탈로그 키를 문자열로 조회한다(타입 키 유니온 우회).
    } as never) as unknown as ReadingRenderContext['t'];
    const tLabel = createTranslator({
        locale,
        messages,
        namespace: 'shared.enumLabel',
        // safe: 위와 같다.
    } as never) as unknown as ReadingRenderContext['tLabel'];
    const listFormat = new Intl.ListFormat(locale, {
        style: 'long',
        type: 'conjunction',
    });
    return {
        t: tReading,
        tLabel,
        format: formatReadingNumber,
        list: items => listFormat.format(items),
    };
}
