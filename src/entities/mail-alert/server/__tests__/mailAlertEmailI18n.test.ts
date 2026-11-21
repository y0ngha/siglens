const { getTranslations } = vi.hoisted(() => ({ getTranslations: vi.fn() }));

vi.mock('server-only', () => ({}));
vi.mock('next-intl/server', () => ({ getTranslations }));

import {
    getMailAlertDisclaimer,
    getMailAlertEmailTranslator,
} from '../mailAlertEmailI18n';

describe('알림 메일 번역자', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('로케일을 명시한 알림 메일 네임스페이스 번역자를 만든다', async () => {
        const translator = vi.fn();
        getTranslations.mockResolvedValue(translator);

        await expect(getMailAlertEmailTranslator('en')).resolves.toBe(
            translator
        );

        expect(getTranslations).toHaveBeenCalledWith({
            locale: 'en',
            namespace: 'entities.mail-alert.email',
        });
    });

    it('면책 고지는 사이트 공통 법무 문구를 그 로케일로 읽는다', async () => {
        getTranslations.mockResolvedValue((key: string) => `T(${key})`);

        await expect(getMailAlertDisclaimer('ja')).resolves.toBe(
            'T(investmentDisclaimer)'
        );

        expect(getTranslations).toHaveBeenCalledWith({
            locale: 'ja',
            namespace: 'shared.legal',
        });
    });
});
