import { kindLabelKey } from '../lib/kindLabel';
import type { ShareableKind } from '@/entities/shared-analysis';
import koMessages from '@/../messages/ko.json';
import enMessages from '@/../messages/en.json';
import jaMessages from '@/../messages/ja.json';
import zhMessages from '@/../messages/zh.json';

const CATALOGS = {
    ko: koMessages,
    en: enMessages,
    ja: jaMessages,
    zh: zhMessages,
};

/**
 * 예전에는 이 함수가 한국어 문자열을 돌려줬고 테스트도 그 문자열을 고정했다 —
 * 공유 페이지의 종류 칩과 OG 이미지가 네 로케일 전부 한국어였다.
 *
 * 이제 **키**를 돌려주므로, 그 키가 네 로케일 카탈로그에 다 있는지를 본다.
 * 새 kind를 추가하고 번역을 빠뜨리면 여기서 실패한다.
 */
describe('kindLabelKey', () => {
    const KINDS: ShareableKind[] = [
        'chart',
        'overall',
        'news',
        'fundamental',
        'financials',
        'congress',
        'options',
        'fear-greed',
    ];

    it.each(KINDS)('%s 키가 네 로케일에 다 있다', kind => {
        const key = kindLabelKey(kind);
        expect(key.startsWith('shareKind.')).toBe(true);

        const sub = key.slice('shareKind.'.length);
        for (const [locale, catalog] of Object.entries(CATALOGS)) {
            const group = (
                catalog.shared.enumLabel as unknown as Record<
                    string,
                    Record<string, string>
                >
            ).shareKind;

            expect(group[sub], `${locale}: ${key}`).toBeTruthy();
        }
    });

    it('kind마다 서로 다른 키를 준다', () => {
        // 복사·붙여넣기로 같은 키가 두 번 들어가면 두 칩이 같은 라벨을 쓴다.
        expect(new Set(KINDS.map(kindLabelKey)).size).toBe(KINDS.length);
    });
});
