import { getTranslations } from 'next-intl/server';

/**
 * 회귀 가드 — `/news`·`/news/us` 본문 카피가 ko 원문("한국어로 정리해
 * 드려요")을 문자 그대로 번역해서, en 페이지가 "summarized **in Korean**
 * by AI"를 outputs했다. ja/zh는 "일본어로"/"中文" 식으로 번역해 **읽는
 * 로케일 언어로 요약한다는 다른 거짓 주장**을 했다 — 실제로는 모든 로케일이
 * 같은 한국어 소스 AI 요약(titleKo/summaryKo)을 보여줄 뿐, 로케일별로 다시
 * 요약하지 않는다.
 *
 * `app.news` 네임스페이스 실제 카탈로그를 거쳐야 회귀를 잡을 수 있어
 * `getTranslations`로 직접 읽는다(컴포넌트 mock으로 우회하지 않는다).
 */
describe('/news, /news/us 본문 카피 — 번역 언어 오주장 없음', () => {
    it('en: "in Korean"을 주장하지 않는다', async () => {
        const t = await getTranslations({
            locale: 'en',
            namespace: 'app.news',
        });

        const newsHubCopy = t('page.17728f');
        const newsUsCopy = t('page.d97943');

        expect(newsHubCopy.toLowerCase()).not.toContain('in korean');
        expect(newsUsCopy.toLowerCase()).not.toContain('in korean');
    });

    it('ja: "日本語で"(일본어로 요약)를 주장하지 않는다', async () => {
        const t = await getTranslations({
            locale: 'ja',
            namespace: 'app.news',
        });

        expect(t('page.17728f')).not.toContain('日本語で');
        expect(t('page.d97943')).not.toContain('日本語で');
    });

    it('zh: "整理成中文"(중국어로 정리)을 주장하지 않는다', async () => {
        const t = await getTranslations({
            locale: 'zh',
            namespace: 'app.news',
        });

        expect(t('page.17728f')).not.toContain('整理成中文');
        expect(t('page.d97943')).not.toContain('整理成中文');
    });
});
