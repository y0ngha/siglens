# Analysis Report Copy Design

## Goal

Add a "report copy" action to `AnalysisPanel` so users can copy the current AI analysis as a polished expert-style report that is suitable for posting in communities, blogs, or notes without sounding like casual social copy.

The copied output must:

- preserve the actual analysis meaning
- emphasize concrete numbers and price zones
- read like a professional market note
- avoid explicit buy/sell solicitation language
- still include a practical "how I would respond" interpretation such as waiting, staged entry attempts, or preparing to reduce exposure

## Non-Goals

- building a full publishing editor
- generating multiple social-media-specific variants in v1
- adding image export in v1
- replacing the existing `analysis.summary` shown in the panel

## User Problem

Users can read the analysis in the app, but turning it into a postable expert report currently requires manual rewriting. That creates friction and reduces the chance that analysis gets shared externally.

The feature should let a user move from "I see the analysis" to "I have a clean professional report in my clipboard" in one action.

## Recommended Approach

Use a hybrid design with a local report builder as the default path and an optional server-side AI rewrite path behind the same interface.

### Why this approach

- local generation is immediate, cheap, and reliable
- current `AnalysisPanel` data already contains enough structure to build a strong first version
- if quality testing later shows that server rewriting produces meaningfully better results, the implementation can switch without redesigning the UI

## Alternatives Considered

### 1. Local template builder only

Pros:

- fastest to ship
- no extra latency or model cost
- no new backend failure mode

Cons:

- prose quality depends entirely on template design
- can become formulaic across repeated use

### 2. Server AI rewrite only

Pros:

- best chance of natural, expert-style prose
- easier to tune tone centrally

Cons:

- adds latency, cost, and failure handling
- requires an extra generation step for a feature that should feel instant

### 3. Hybrid builder + rewrite

Pros:

- reliable default path
- upgradeable quality path
- one UI can support both modes

Cons:

- slightly more design work up front

Recommendation: choose option 3, with local generation enabled first.

## UX Design

### Entry Point

Add a `리포트 복사` action in the `AnalysisPanel` header area.

The action should be visible on desktop and mobile. It should not displace the core analysis header information.

### Interaction

Initial version:

- one primary action: `리포트 복사`
- click builds the report text and writes it to the clipboard
- button state changes to `복사됨` for about 2 seconds after success
- on failure, show a lightweight failure notice in the panel

Future-ready extension:

- a small menu or secondary action can later offer `기본 리포트 복사` vs `고급 리포트 생성 후 복사`

### UX Constraints

- the action must work without interrupting analysis reading flow
- it must not require opening a modal in v1
- copied text should be immediately usable without cleanup

## Output Format

The copied result should be a single plain-text report, optimized for readability in community posts, blog drafts, notes, and messenger sharing.

Target structure:

1. Headline summary
2. Current market interpretation
3. Key price levels
4. Technical evidence
5. Scenario analysis
6. Practical response stance
7. Risk note

### Example structure

```text
[AAPL] 기술적 분석 리포트

현재 흐름은 중기 상승 추세를 유지하는 가운데, 단기적으로는 212.50 저항 돌파 여부가 중요한 구간입니다. 주요 지지 구간은 205.80과 202.10으로 해석되며, 이 범위가 유지되는 한 추세 훼손보다 눌림 이후 재시도 가능성을 우선적으로 볼 수 있습니다.

주요 가격 구간:
- 저항: 212.50, 218.30
- 지지: 205.80, 202.10
- 목표 가격: ...

기술적 근거:
- RSI ...
- MACD ...
- 패턴 ...

시나리오:
- 212.50 상향 안착 시 ...
- 202.10 이탈 시 ...

대응 관점:
현 시점에서는 추격 대응보다 지지 확인 이후 분할 접근 가능성을 검토하는 구간으로 해석됩니다. 반대로 핵심 지지 이탈 시에는 관망 또는 기존 포지션 관리 관점이 더 적절합니다.

리스크:
변동성 확대 구간에서는 지지/저항 해석이 빠르게 무효화될 수 있습니다.
```

## Tone Rules

The report must sound like a professional analyst note, not a social post or casual commentary.

Required characteristics:

- declarative and concise
- evidence-first
- numeric where possible
- scenario-oriented
- practical but not promotional

Forbidden characteristics:

- hype language
- sensational or emotionally charged wording
- direct investment solicitation
- community slang or influencer tone

## Content Rules

### Must include when data exists

- trend interpretation
- risk level framing
- support and resistance levels
- notable indicator or pattern evidence
- action-oriented interpretation using neutral phrasing

### Must avoid

- guaranteeing outcomes
- imperative buy/sell commands
- invented values not present in analysis data

### Allowed practical phrasing

- `관망이 유리한 구간으로 해석됩니다`
- `지지 확인 이후 분할 접근 가능성을 볼 수 있습니다`
- `단기적으로는 비중 축소 준비 관점이 더 적절합니다`
- `추세 확인 전까지는 공격적 대응보다 확인 중심 접근이 적절합니다`

These phrases are interpretive guidance, not direct recommendations.

## Data Sources

The local builder should rely only on currently available panel inputs.

Primary inputs:

- `analysis.summary`
- `analysis.trend`
- `analysis.riskLevel`
- `analysis.actionRecommendation`
- `analysis.patternSummaries`
- `analysis.strategyResults`
- `analysis.indicatorResults`
- `analysis.trendlines`
- `keyLevels`

Optional future inputs:

- symbol metadata such as company name or Korean name
- timeframe label if available in the panel context

## Architecture

### UI Layer

`AnalysisPanel` owns the button and success/failure state display.

Responsibilities:

- render the `리포트 복사` action
- invoke report generation
- write to clipboard
- show transient copy state

### Report Builder Layer

Create a dedicated builder module, separate from the component, responsible for assembling plain text.

Proposed shape:

- `buildExpertAnalysisReport(input): string`

Responsibilities:

- choose which sections to include
- format numbers and level lists
- transform action recommendations into neutral stance language
- keep output coherent even if some sections are missing

### Optional Rewrite Layer

Add an abstraction that can later support two generation modes:

- `local`: deterministic template-based output
- `server`: model-assisted rewrite based on the same structured input

Proposed shape:

- `generateShareableAnalysisReport(input, mode): Promise<string> | string`

The UI should depend on the interface, not the implementation details.

## Local Builder Design

The local builder should generate sections in this order:

1. title
2. core interpretation paragraph
3. key levels block
4. evidence block
5. scenario block
6. response stance block
7. risk note

### Selection rules

- if there are no detected patterns, omit the pattern line
- if there are no reliable strategy results, omit that evidence line
- if action recommendation is missing, infer stance from trend, risk, and key levels conservatively
- if only one support or resistance exists, still render the section

### Formatting rules

- use a fixed decimal display policy consistent with existing panel formatting
- avoid excessive bullet count
- prefer short paragraphs over long lists
- keep the full report short enough to paste comfortably into community text boxes

## Server Rewrite Design

The server rewrite path is optional for v1 but should be supported by the architecture.

If enabled later:

- send structured analysis data, not raw HTML or rendered text
- instruct the model to preserve all numeric levels exactly
- instruct the model to keep a professional analyst tone
- forbid direct solicitation phrasing
- fall back to local generation if the rewrite fails or times out

### Quality bar for adopting server rewrite

Only switch to server-first if testing shows clear improvement in:

- readability
- perceived expertise
- faithfulness to the original analysis
- retention of key numeric levels

## Error Handling

### Clipboard failure

- show a small failure message near the action
- do not break the panel

### Missing or sparse analysis data

- generate the best possible partial report
- omit empty sections rather than emitting placeholders

### Server rewrite failure

- silently or explicitly fall back to local generation depending on UX tuning
- never leave the user without a copyable result if local generation is available

## Testing Strategy

### Unit tests

Add tests for the report builder to verify:

- support and resistance levels appear correctly
- omitted data produces clean output
- action stance language stays neutral
- output includes key evidence when present
- numbers are preserved exactly from source inputs

### Component tests

Verify:

- copy action calls clipboard with generated text
- success state changes to `복사됨`
- failure state is surfaced correctly

### Future server-path tests

Verify:

- fallback to local report on timeout or rewrite failure
- numeric values are preserved in rewritten output

## Open Decisions Resolved

- primary output style: expert report
- emphasis: numeric levels and evidence
- stance language: practical but non-soliciting
- release strategy: local-first hybrid design

## Implementation Notes

The builder should live outside `AnalysisPanel` to keep the component focused on display concerns. This also makes report generation independently testable and easier to upgrade later.

The implementation should reuse existing panel formatting conventions where reasonable so copied values match what users already see in the UI.

## Success Criteria

The feature is successful when:

- a user can copy a polished report from `AnalysisPanel` in one action
- the copied text reflects the AI analysis accurately
- the report includes meaningful numeric levels and technical rationale
- the tone feels professional rather than promotional
- the feature remains reliable even without additional AI generation
