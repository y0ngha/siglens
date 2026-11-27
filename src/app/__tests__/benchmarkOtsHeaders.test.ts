import { describe, expect, it } from 'vitest';
import nextConfig from '../../../next.config';

describe('nextConfig 벤치마크 .ots 헤더', () => {
    it('/benchmark 아래 .ots는 application/octet-stream으로 나간다', async () => {
        const rules = (await nextConfig.headers?.()) ?? [];
        const rule = rules.find(r => r.source === '/benchmark/:path*.ots');

        expect(rule?.headers).toContainEqual({
            key: 'Content-Type',
            value: 'application/octet-stream',
        });
    });
});
