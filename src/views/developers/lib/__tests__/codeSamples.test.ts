import { describe, expect, it } from 'vitest';
import { buildCurlExample } from '@/entities/siglens-api-key/lib/buildApiToolReferences';
import {
    AUTHORIZATION_HEADER_EXAMPLE,
    ENV_EXPORT_COMMAND,
    LOCALE_HEADER_EXAMPLE,
    meCurlCommand,
    skillInstallCommand,
    streamingExampleCommand,
} from '../codeSamples';

const API_BASE = 'https://example.test/api/v1';

/** Lines of a multi-line shell command that do not end with a line continuation (the last line is exempt). */
function unjoinedLines(command: string): string[] {
    return command
        .split('\n')
        .slice(0, -1)
        .filter(line => !line.endsWith(' \\'));
}

describe('codeSamples', () => {
    it('builds the env export, auth header and locale header examples from the shared constants', () => {
        expect(ENV_EXPORT_COMMAND).toBe('export SIGLENS_API_KEY=slk_…');
        expect(AUTHORIZATION_HEADER_EXAMPLE).toBe(
            'Authorization: Bearer slk_…'
        );
        expect(LOCALE_HEADER_EXAMPLE).toBe('X-Siglens-Locale: en');
    });

    it('builds the GET /me call as one continued command', () => {
        expect(meCurlCommand(API_BASE)).toBe(
            [
                'curl -s https://example.test/api/v1/me \\',
                '  -H "Authorization: Bearer $SIGLENS_API_KEY"',
            ].join('\n')
        );
    });

    it('builds the skill install as mkdir followed by a continued curl', () => {
        expect(skillInstallCommand(API_BASE)).toBe(
            [
                'mkdir -p ~/.claude/skills/siglens',
                'curl -s https://example.test/api/v1/skill \\',
                '  -o ~/.claude/skills/siglens/SKILL.md',
            ].join('\n')
        );
    });

    it('continues the last curl line into the jq pipe so the shell reads one command', () => {
        const curl = buildCurlExample(
            `${API_BASE}/tools/run_fresh_analysis`,
            { symbol: 'AAPL' },
            { maxTimeSeconds: 300 }
        );
        // The tool curl ends with `-d '…'` and no continuation — the pipe line must not start a new command.
        expect(curl.endsWith('-d \'{"symbol":"AAPL"}\'')).toBe(true);
        const command = streamingExampleCommand(curl);
        expect(unjoinedLines(command)).toEqual([]);
        expect(command.split('\n').slice(-2)).toEqual([
            '  -d \'{"symbol":"AAPL"}\' \\',
            "  | jq 'if .error then {failed: .error} else .data end'",
        ]);
    });
});
