#!/usr/bin/env node

/**
 * SubagentStop hook — validates that sub-agents emit a proper exit signal.
 *
 * Claude Code passes hook input via stdin as JSON.
 * Input shape: { session_id, transcript_path, stop_hook_active, ... }
 *
 * Exit codes:
 *   0 — valid exit signal found, allow the sub-agent to stop
 *   2 — no valid exit signal found, block the sub-agent from stopping
 *       (stderr is fed back to the sub-agent as an error message)
 */

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

function main() {
    // Prevent infinite loop: if SubagentStop was already triggered once, allow stop
    let input = {};
    try {
        const raw = fs.readFileSync('/dev/stdin', 'utf8');
        input = JSON.parse(raw);
    } catch {
        // If stdin is empty or unparseable, allow stop (don't block on hook errors)
        process.exit(0);
    }

    if (input.stop_hook_active === true) {
        process.exit(0);
    }

    // Read transcript to find the last assistant message
    const transcriptPath = input.transcript_path;
    if (!transcriptPath) {
        process.exit(0);
    }

    let transcript = '';
    try {
        transcript = fs.readFileSync(transcriptPath, 'utf8');
    } catch {
        process.exit(0);
    }

    // Parse JSONL transcript — find the last assistant message
    const lines = transcript.trim().split('\n');
    let lastAssistantContent = '';
    for (const line of [...lines].reverse()) {
        try {
            const entry = JSON.parse(line);
            if (entry.role === 'assistant' || entry.type === 'assistant') {
                lastAssistantContent = typeof entry.content === 'string'
                    ? entry.content
                    : JSON.stringify(entry.content);
                break;
            }
        } catch {
            continue;
        }
    }

    if (!lastAssistantContent) {
        process.exit(0);
    }

    // Extract JSON block from the last assistant message
    const jsonMatch = lastAssistantContent.match(/\{[\s\S]*?"agent"[\s\S]*?\}/);
    if (!jsonMatch) {
        console.error(
            '[hook] ⚠️  Sub-agent did not emit a valid exit signal.\n' +
            'Expected a JSON object with "agent" and "status" fields as the final output.\n' +
            'Example: { "agent": "implementation-agent", "status": "done", "branch": "feat/#1/..." }'
        );
        process.exit(2);
    }

    let signal;
    try {
        signal = JSON.parse(jsonMatch[0]);
    } catch {
        console.error('[hook] ⚠️  Exit signal JSON is malformed. Fix the JSON syntax and retry.');
        process.exit(2);
    }

    if (!signal.agent || !signal.status) {
        console.error('[hook] ⚠️  Exit signal is missing required fields: "agent" and/or "status".');
        process.exit(2);
    }

    if (!KNOWN_AGENTS.includes(signal.agent)) {
        console.error(`[hook] ⚠️  Unknown agent name: "${signal.agent}". Expected one of: ${KNOWN_AGENTS.join(', ')}`);
        process.exit(2);
    }

    if (!VALID_STATUSES.includes(signal.status)) {
        console.error(`[hook] ⚠️  Invalid status: "${signal.status}". Expected one of: ${VALID_STATUSES.join(', ')}`);
        process.exit(2);
    }

    console.log(`[hook] ✅ Exit signal valid: agent=${signal.agent} status=${signal.status}`);
    process.exit(0);
}

main();