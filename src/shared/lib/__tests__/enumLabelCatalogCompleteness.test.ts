import { getTranslations } from 'next-intl/server';
import koMessages from '../../../../messages/ko.json';

/**
 * **`shared.enumLabel` 카탈로그 ↔ 로케일 완전성.**
 *
 * 개별 소비자(`trendUtils`, `OptionsAiAnalysis`, `FinancialHealthCard` …)를
 * 하나씩 렌더 테스트하는 대신, `shared.enumLabel` 전체 키를 ko 카탈로그에서
 * 뽑아 en 번역자로 직접 호출해 검증한다 — 새 그룹을 추가할 때마다 별도
 * 컴포넌트 테스트를 늘리지 않아도 이 한 파일이 회귀를 잡는다.
 *
 * ko를 소스로 쓰는 이유: `DEFAULT_LOCALE`이고, 이 카탈로그의 키는 전부 ko
 * 소비자 코드에서 파생됐다(추가 키가 en에만 있고 ko에 없는 경우는 없다).
 */
function collectEnumLabelKeys(): string[] {
    const enumLabel = (
        koMessages as { shared: { enumLabel: Record<string, unknown> } }
    ).shared.enumLabel;
    const keys: string[] = [];
    for (const [group, entries] of Object.entries(enumLabel)) {
        for (const key of Object.keys(entries as Record<string, string>)) {
            keys.push(`${group}.${key}`);
        }
    }
    return keys;
}

const ENUM_LABEL_KEYS = collectEnumLabelKeys();

describe('shared.enumLabel — en 카탈로그 완전성', () => {
    it('ko 카탈로그에서 키를 실제로 찾아낸다', () => {
        // 0건이면 아래 it.each가 사라져 가드가 조용히 무력화된다.
        expect(ENUM_LABEL_KEYS.length).toBeGreaterThan(30);
    });

    it.each(ENUM_LABEL_KEYS)('%s: en에서 한글이 섞이지 않는다', async key => {
        const t = await getTranslations({
            locale: 'en',
            namespace: 'shared.enumLabel',
        });
        expect(t(key)).not.toMatch(/[가-힣]/);
    });
});
