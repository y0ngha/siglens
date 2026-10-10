import koMessages from '../../../../messages/ko.json';
import enMessages from '../../../../messages/en.json';
import jaMessages from '../../../../messages/ja.json';
import zhMessages from '../../../../messages/zh.json';
import { SITE_NAME } from '@/shared/lib/seo';

type LegalTable = Record<string, string>;
const legalOf = (messages: unknown): LegalTable =>
    (messages as { shared: { lib: { legal: LegalTable } } }).shared.lib.legal;

/**
 * 약관 화면 문구의 한국어 조사.
 *
 * `{v0}`에 들어가는 `SITE_NAME`(`SIGLENS`)은 받침 없이 끝나는 영문이라 `은(는)`·`이(가)`
 * 같은 이중 표기를 쓰면 화면에 그대로 "SIGLENS은(는)"이 찍힌다. 조사를 고정하되 DB 약관
 * 본문(`db/seeds`)은 버전·시행일이 걸린 별도 문서라 이 카탈로그와 따로 다룬다.
 */
describe('shared.lib.legal 약관 문구', () => {
    const ko = legalOf(koMessages);

    it('termsNoticeBody: 이중 조사 표기 없이 "{v0}는"으로 쓴다', () => {
        expect(ko.termsNoticeBody).toMatch(/^\{v0\}는 투자 자문이나/);
        expect(ko.termsNoticeBody).not.toMatch(/은\(는\)|이\(가\)/);
    });

    it('termsIntro: 이중 조사 표기 없이 "(이하 \\"운영자\\")가"로 이어진다', () => {
        expect(ko.termsIntro).toContain('(이하 "운영자")가 제공하는');
        expect(ko.termsIntro).not.toMatch(/은\(는\)|이\(가\)/);
    });

    it('termsIntro: 이용약관 제1조(DB 시드 tos v2)와 같은 서비스 범위를 말한다', () => {
        // 한때 "미국 주식 기술적 분석 웹 서비스"만 적어, 국내 주식·암호화폐·SIGLENS AI를
        // 쓰는 이용자에게 약관 첫 문장이 서비스 범위를 잘못 말했다.
        expect(ko.termsIntro).toContain(
            '미국 주식·국내 주식·암호화폐 분석 웹 서비스 및 시그렌즈 AI 대화 서비스(이하 "서비스")'
        );
        expect(ko.termsIntro).not.toContain('미국 주식 기술적 분석');
    });

    it.each([
        [
            'en',
            enMessages,
            /US stock[\s\S]*Korean stock[\s\S]*crypto[\s\S]*SIGLENS AI/,
        ],
        [
            'ja',
            jaMessages,
            /米国株[\s\S]*韓国株[\s\S]*暗号資産[\s\S]*SIGLENS AI/,
        ],
        [
            'zh',
            zhMessages,
            /美国股票[\s\S]*韩国股票[\s\S]*加密货币[\s\S]*SIGLENS AI/,
        ],
    ] as const)(
        '%s: termsIntro도 같은 서비스 범위와 {v0}를 유지한다',
        (_l, messages, scope) => {
            const intro = legalOf(messages).termsIntro;

            expect(intro).toMatch(scope);
            expect(intro).toContain('{v0}');
            expect(intro).not.toMatch(/[가-힣]/);
        }
    );

    it('ko 약관·개인정보 문구 전체에 이중 조사 표기(은(는)·이(가)·을(를))가 없다', () => {
        // `privacyBottomNotice`의 `<link>이용약관</link>을(를)`처럼 받침이 정해진 고정
        // 명사 뒤에도 이중 표기는 쓰지 않는다 — 이용약관은 받침이 있어 "을"이다.
        const offenders = Object.entries(ko).filter(([, value]) =>
            /은\(는\)|이\(가\)|을\(를\)|와\(과\)|으로\(로\)/.test(value)
        );

        expect(offenders).toEqual([]);
    });

    it('privacyBottomNotice: 링크 뒤 조사는 "을"이다', () => {
        expect(ko.privacyBottomNotice).toContain(
            '<link>이용약관</link>을 참고'
        );
    });

    it('카탈로그 조사는 실제 SITE_NAME과 이어 읽어도 어색하지 않다', () => {
        expect(SITE_NAME).toBe('SIGLENS');
        expect(ko.termsNoticeBody.replace('{v0}', SITE_NAME)).toMatch(
            /^SIGLENS는 투자 자문이나/
        );
    });
});
