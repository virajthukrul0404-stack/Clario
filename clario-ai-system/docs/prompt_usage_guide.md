# Prompt Usage Guide — Clario AI System

## How to Read a Prompt File

Every prompt in this system follows the same structure:

```
## Agent/Skill Name

### Identity / Context
Who this agent is and what it's responsible for.

### Personality / Operating Principles
How it behaves, what it never does, tone boundaries.

### Core Responsibilities
Numbered list of what it does, in priority order.

### Input/Output Formats
Exact JSON schemas or text formats for structured outputs.

### Rules / Constraints
Hard rules that cannot be overridden.
```

---

## Template Variable System

Skills use `{{variable}}` syntax. Variables are dot-notated paths into a context object.

### Standard Context Object
```typescript
interface ClarioContext {
  learner: {
    id: string;
    name: string;
    email: string;
    goal: string;
    level: 'beginner' | 'intermediate' | 'advanced';
    stylePreference: 'structured' | 'exploratory' | 'project-based' | 'conversational';
    sessionHistory: Session[];
    currentTeacher: string | null;
    lastSessionDate: string | null;
    actionItemsOutstanding: ActionItem[];
    timeAvailable: string;
    timezone: string;
    availability: TimeSlot[];
  };
  teacher: {
    id: string;
    name: string;
    bio: string;
    topics: string[];
    teachingStyle: string;
    sessionCount: number;
    repeatLearnerRate: number;
    availability: TimeSlot[];
    timezone: string;
    feedbackHistory: Feedback[];
    cancelRate: number;
    earnings: { weekly: number; monthly: number };
    conversionRate: number;
    avgSearchPosition: number;
  };
  session: {
    id: string;
    teacherName: string;
    topic: string;
    datetime: string;
    duration: number;
    durationActual: number;
    durationScheduled: number;
    previousCount: number;
    lastSummary: string;
    topicsCovered: string[];
    actionItems: ActionItem[];
    conductorNotes: string;
    numberInRelationship: number;
    learnerFeedback: string;
    teacherFeedback: string;
    actionItemsCount: number;
    statedGoal: string;
    number: number;
    previousTopics: string[];
  };
  cancellation: {
    initiator: 'learner' | 'teacher' | 'system';
    hoursNotice: number;
    reason: string | null;
  };
  event: {
    type: string;
    data: Record<string, unknown>;
  };
  notification: {
    channel: 'push' | 'email' | 'in_app';
  };
  recipient: {
    name: string;
    role: 'learner' | 'teacher';
  };
  feedback: {
    responses: Array<{ question: string; answer: string; session_date: string }>;
  };
  match: {
    score: number;
    factors: string[];
  };
  query: string;
  message: string;
}
```

---

## Agent Invocation Patterns

### Pattern 1: Direct message agent (Aria, Cleo, Onboarding)
```javascript
// Multi-turn conversation with persistent system prompt
const messages = [
  ...conversationHistory,
  { role: 'user', content: userMessage }
];

const response = await anthropic.messages.create({
  model: 'claude-sonnet-4-6',
  max_tokens: 1024,
  system: agentSystemPrompt,
  messages
});
```

### Pattern 2: One-shot skill (Intent Parser, Quality Reviewer)
```javascript
// Single call, structured JSON output
const response = await anthropic.messages.create({
  model: 'claude-haiku-4-5-20251001',
  max_tokens: 512,
  messages: [{
    role: 'user',
    content: injectTemplate(skillPrompt, context)
  }]
});

const result = JSON.parse(response.content[0].text);
```

### Pattern 3: Background agent (Conductor, Trust Layer)
```javascript
// Triggered by event, no user-facing output
async function onSessionEnd(sessionData) {
  const context = buildContext(sessionData);
  
  const [learnerSummary, teacherNotes] = await Promise.all([
    runAgent('session_conductor', context, 'learner'),
    runAgent('session_conductor', context, 'teacher')
  ]);

  await db.session.update({
    where: { id: sessionData.id },
    data: {
      learnerSummary: learnerSummary,
      teacherNotes: teacherNotes,
      conductedAt: new Date()
    }
  });
}
```

### Pattern 4: Universal Supervisor gate
```javascript
async function gatedAgentResponse(agentId, agentOutput, context) {
  const gateResult = await runAgent('universal_supervisor', {
    mode: 'quality_gate',
    agent_id: agentId,
    output: agentOutput,
    context: context
  });

  if (gateResult.gate_result === 'fail') {
    logger.warn('quality_gate.blocked', { agentId, reason: gateResult.block_reason });
    return getFallbackResponse(agentId);
  }

  if (gateResult.gate_result === 'modify') {
    return await modifyOutput(agentOutput, gateResult.modification_instruction);
  }

  return agentOutput;
}
```

---

## Model Selection Guide

| Use Case | Recommended Model | Reason |
|----------|------------------|--------|
| Aria, Cleo (user-facing chat) | claude-sonnet-4-6 | Best balance of quality and speed |
| Universal Supervisor | claude-opus-4-6 | Needs highest reasoning for orchestration |
| Security Tester | claude-opus-4-6 | Complex security reasoning |
| Product Manager | claude-sonnet-4-6 | Strategic reasoning needed |
| Intent Parser | claude-haiku-4-5-20251001 | Fast, cheap, JSON output |
| Notification Composer | claude-haiku-4-5-20251001 | Simple structured output |
| Quality Reviewer | claude-haiku-4-5-20251001 | Pattern matching, fast |
| Insight Engine | claude-sonnet-4-6 | Narrative quality matters |
| Pairing Engine | claude-sonnet-4-6 | Semantic reasoning needed |

---

## Rate Limiting Recommendations

```javascript
// Upstash rate limits per endpoint type
const rateLimits = {
  'aria_message': { requests: 30, window: '1m' },        // 30 messages/min per user
  'search_query': { requests: 10, window: '10s' },        // 10 searches/10s per user
  'session_booking': { requests: 5, window: '1h' },       // 5 bookings/hr per user
  'pairing_engine': { requests: 20, window: '1m' },       // 20 matches/min per user
  'notification_compose': { requests: 100, window: '1h' }, // 100 notifs/hr system-wide
  'trust_layer': { requests: 500, window: '1h' }          // High volume for reviews
};
```

---

## Error Handling

Every agent call should handle these error states:

```javascript
const AgentError = {
  RATE_LIMITED: 'AGENT_RATE_LIMITED',
  CONTEXT_MISSING: 'AGENT_CONTEXT_MISSING',
  QUALITY_GATE_BLOCKED: 'AGENT_QUALITY_GATE_BLOCKED',
  PARSE_FAILED: 'AGENT_PARSE_FAILED',
  TIMEOUT: 'AGENT_TIMEOUT',
  MODEL_ERROR: 'AGENT_MODEL_ERROR'
};

// Always have a fallback for user-facing agents
const fallbacks = {
  'aria': "I'm having a moment — let me try again.",
  'cleo': "Something went wrong loading that. Try refreshing.",
  'onboarding_guide': "Welcome to Clario! Let's find you the right teacher.",
  'session_conductor': null // Silent — no fallback needed
};
```

---

## Testing Prompts

Before deploying any prompt to production:

1. **Happy path test:** Feed it ideal, complete input. Verify output format.
2. **Missing context test:** Remove key variables. Verify graceful handling.
3. **Edge case test:** Empty arrays, very short/long inputs, unusual characters.
4. **Tone test:** Verify the output doesn't violate tone boundaries (no "Great!", no urgency).
5. **JSON validity test:** For structured outputs, run JSON.parse on 10 samples.
6. **Gate test:** Run output through Universal Supervisor gate prompt. Verify it passes.
