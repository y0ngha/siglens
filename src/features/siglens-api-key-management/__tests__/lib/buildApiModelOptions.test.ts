import {
    buildApiModelOptionGroups,
    listApiKeyProviderLabels,
} from '@/features/siglens-api-key-management/lib/buildApiModelOptions';
import { listApiSelectableModels } from '@/entities/siglens-api-key/lib/apiModels';

describe('buildApiModelOptionGroups', () => {
    it('키를 등록하지 않았으면 그룹이 없다', () => {
        expect(buildApiModelOptionGroups([])).toEqual([]);
    });

    it('등록한 provider의 모델만 provider별로 묶는다', () => {
        const groups = buildApiModelOptionGroups(['anthropic']);
        expect(groups).toHaveLength(1);
        expect(groups[0]).toMatchObject({
            provider: 'anthropic',
            providerLabel: 'Claude (Anthropic)',
        });
        expect(groups[0].options.map(option => option.id)).toEqual(
            listApiSelectableModels(['anthropic'])
        );
    });

    it('표시 이름은 분석 화면 모델 선택기와 같은 표를 쓴다', () => {
        const [group] = buildApiModelOptionGroups(['anthropic']);
        expect(
            group.options.find(option => option.id === 'claude-opus-5')?.label
        ).toBe('Claude Opus 5');
    });

    it('등록한 provider의 free·member 등급 모델(haiku·sonnet)도 선택지에 나오고, 등록하지 않은 provider 모델은 나오지 않는다', () => {
        const ids = buildApiModelOptionGroups(['anthropic']).flatMap(group =>
            group.options.map(option => option.id)
        );
        expect(ids).toContain('claude-haiku-5-5');
        expect(ids).toContain('claude-sonnet-5-5');
        expect(ids).toContain('claude-opus-5');
        expect(ids.some(id => id.startsWith('gpt-'))).toBe(false);
    });

    it('deepseek만 등록해도 그 provider의 모델이 선택지가 된다(모든 모델을 사용자 키로 생성한다)', () => {
        const groups = buildApiModelOptionGroups(['deepseek']);
        expect(groups).toHaveLength(1);
        expect(groups[0].provider).toBe('deepseek');
        expect(groups[0].options.length).toBeGreaterThan(0);
    });

    it('여러 provider를 등록하면 각각 그룹이 된다', () => {
        const groups = buildApiModelOptionGroups(['openai', 'google']);
        expect(groups.map(group => group.provider).toSorted()).toEqual([
            'google',
            'openai',
        ]);
    });
});

describe('listApiKeyProviderLabels', () => {
    it('로스터에 모델이 있는 provider의 표시 이름을 나열한다(등급과 무관하므로 DeepSeek도 들어간다)', () => {
        const label = listApiKeyProviderLabels();
        expect(label).toContain('Claude (Anthropic)');
        expect(label).toContain('ChatGPT (OpenAI)');
        expect(label).toContain('Gemini (Google)');
        expect(label).toContain('DeepSeek');
    });
});
