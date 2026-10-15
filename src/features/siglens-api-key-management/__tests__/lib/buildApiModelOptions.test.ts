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

    it('등록하지 않은 provider와 서버 키 모델(haiku 등)은 나오지 않는다', () => {
        const ids = buildApiModelOptionGroups(['anthropic']).flatMap(group =>
            group.options.map(option => option.id)
        );
        expect(ids).not.toContain('claude-haiku-5-5');
        expect(ids.some(id => id.startsWith('gpt-'))).toBe(false);
    });

    it('byok 모델이 없는 provider만 등록했으면 그룹이 없다', () => {
        expect(buildApiModelOptionGroups(['deepseek'])).toEqual([]);
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
    it('생성 가능한 모델이 있는 provider의 표시 이름만 나열한다(deepseek은 byok 모델이 없어 빠진다)', () => {
        const label = listApiKeyProviderLabels();
        expect(label).toContain('Claude (Anthropic)');
        expect(label).toContain('ChatGPT (OpenAI)');
        expect(label).toContain('Gemini (Google)');
        expect(label).not.toContain('DeepSeek');
    });
});
