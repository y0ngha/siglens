import { buildLlmsDocument } from '@/app/api/llms/_lib/buildLlmsDocument';
import { testInputs } from '@/app/api/llms/_lib/__tests__/llmsTestInputs';
import type { LlmsHost } from '@/app/api/llms/_lib/model';
import { renderLlmsTxt } from '@/app/api/llms/_lib/renderLlmsTxt';

/**
 * llms.txt 문구 규칙. 모든 게이트를 켠 본문(벤치마크 공개, 공개 API 켜짐)에 건다.
 * 문구는 사이트 카피 규칙(줄표·가운뎃점·이모지 금지, 내부 용어·행동 권유 금지, 낡는 개수 금지)을 따른다.
 */
const HOSTS: readonly LlmsHost[] = ['main', 'ai'];

function body(host: LlmsHost): string {
    return renderLlmsTxt(
        buildLlmsDocument(host, testInputs({ publicApiEnabled: true }))
    );
}

const SUMMARY_PHRASE = '투자 권유가 아닌 정보 제공';

describe.each(HOSTS)('llms.txt 문구 규칙 (%s)', host => {
    const text = body(host);

    it('줄표(— –)와 가운뎃점(·)을 쓰지 않는다', () => {
        expect(text).not.toMatch(/[—–·]/);
    });

    it('이모지를 쓰지 않는다', () => {
        expect(text).not.toMatch(/\p{Extended_Pictographic}/u);
    });

    it('내부 용어를 드러내지 않는다', () => {
        expect(text).not.toMatch(/스킬|프롬프트|토큰|코어/);
    });

    it('행동 권유 표현이 없다', () => {
        expect(text).not.toMatch(
            /매수하세요|매도하세요|사세요|파세요|추천합니다|사는 편|파는 편|들어가세요/
        );
    });

    it('고지 문구는 요약 인용문 안에 한 번 나온다', () => {
        const summary = text.split('\n').find(line => line.startsWith('> '));

        expect(summary).toContain(SUMMARY_PHRASE);
        expect(text.split(SUMMARY_PHRASE)).toHaveLength(2);
    });

    it('낡는 개수를 쓰지 않는다', () => {
        expect(text).not.toMatch(/\d+개|\d+종목/);
    });
});
