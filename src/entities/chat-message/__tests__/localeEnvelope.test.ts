import { describe, expect, it } from 'vitest';
import { withLocaleDirective } from '@/entities/chat-message/lib/localeEnvelope';

describe('withLocaleDirective', () => {
    it('returns the message unchanged for the default locale (ko)', () => {
        expect(withLocaleDirective('AAPL 어때?', 'ko')).toBe('AAPL 어때?');
    });

    it('appends an English directive for en', () => {
        expect(withLocaleDirective('How is AAPL?', 'en')).toBe(
            'How is AAPL?\n\n[Answer in English. Do not answer in Korean.]'
        );
    });

    it('appends a Japanese directive (with the native name) for ja', () => {
        expect(withLocaleDirective('AAPLはどう?', 'ja')).toBe(
            'AAPLはどう?\n\n[Answer in Japanese (日本語). Do not answer in Korean.]'
        );
    });

    it('appends a Simplified Chinese directive (with the native name) for zh', () => {
        expect(withLocaleDirective('AAPL怎么样?', 'zh')).toBe(
            'AAPL怎么样?\n\n[Answer in Simplified Chinese (简体中文). Do not answer in Korean.]'
        );
    });
});
