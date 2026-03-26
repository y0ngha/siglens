#!/usr/bin/env node

/**
 * SubagentStop hook — validates that sub-agents emit a proper exit signal.
 *
 * Claude Code passes hook input via stdin as JSON.
 * Input shape: { session_id, transcript_path, stop_hook_active, ... }
 *
 * Exit codes:
 * 0 — valid exit signal found, allow the sub-agent to stop
 * 2 — no valid exit signal found, block the sub-agent from stopping
 * (stderr is fed back to the sub-agent as an error message)
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require('fs');

const KNOWN_AGENTS = [
    'implementation-agent',
    'review-agent',
    'pr-fix-agent',
    'git-agent',
];

const VALID_STATUSES = [
    'done',
    'failed',
    'approved',
    'changes_requested',
    'loop_limit_reached',
];

function getHookInput() {
    try {
        const raw = fs.readFileSync('/dev/stdin', 'utf8');
        return JSON.parse(raw);
    } catch {
        // If stdin is empty or unparseable, allow stop (don't block on hook errors)
        process.exit(0);
    }
}

function getTranscript(transcriptPath) {
    if (!transcriptPath) {
        process.exit(0);
    }

    try {
        return fs.readFileSync(transcriptPath, 'utf8');
    } catch {
        process.exit(0);
    }
}

function getLastAssistantContent(transcript) {
    const lines = transcript.trim().split('\n');

    for (const line of [...lines].reverse()) {
        try {
            const entry = JSON.parse(line);
            if (entry.role === 'assistant' || entry.type === 'assistant') {
                return typeof entry.content === 'string'
                    ? entry.content
                    : JSON.stringify(entry.content);
            }
        } catch {

        }
    }

    return null;
}

function parseSignal(content) {
    const jsonMatch = content.match(/\{[\s\S]*?"agent"[\s\S]*?}/);

    if (!jsonMatch) {
        exitWithError(
            '[hook] ⚠️  Sub-agent did not emit a valid exit signal.\n' +
                'Expected a JSON object with "agent" and "status" fields as the final output.\n' +
                'Example: { "agent": "implementation-agent", "status": "done", "branch": "feat/#1/..." }'
        );
    }

    try {
        return JSON.parse(jsonMatch[0]);
    } catch {
        exitWithError(
            '[hook] ⚠️  Exit signal JSON is malformed. Fix the JSON syntax and retry.'
        );
    }
}

function validateSignal(signal) {
    if (!signal.agent || !signal.status) {
        exitWithError(
            '[hook] ⚠️  Exit signal is missing required fields: "agent" and/or "status".'
        );
    }

    if (!KNOWN_AGENTS.includes(signal.agent)) {
        exitWithError(
            `[hook] ⚠️  Unknown agent name: "${signal.agent}". Expected one of: ${KNOWN_AGENTS.join(', ')}`
        );
    }

    if (!VALID_STATUSES.includes(signal.status)) {
        exitWithError(
            `[hook] ⚠️  Invalid status: "${signal.status}". Expected one of: ${VALID_STATUSES.join(', ')}`
        );
    }
}

function exitWithError(message) {
    console.error(message);
    process.exit(2);
}

function main() {
    const input = getHookInput();

    // Prevent infinite loop: if SubagentStop was already triggered once, allow stop
    if (input.stop_hook_active === true) {
        process.exit(0);
    }

    const transcript = getTranscript(input.transcript_path);
    const lastAssistantContent = getLastAssistantContent(transcript);

    if (!lastAssistantContent) {
        process.exit(0);
    }

    const signal = parseSignal(lastAssistantContent);

    validateSignal(signal);

    console.log(
        `[hook] ✅ Exit signal valid: agent=${signal.agent} status=${signal.status}`
    );
    process.exit(0);
}

main();
