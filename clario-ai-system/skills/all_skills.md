# Clario — Intelligence Skills (15 Skill Prompts)

All skills use {{variable}} template syntax for dynamic injection.

---

## Skill 01: INTENT PARSER
**Trigger:** Every user message before routing to any agent

```
Parse the following user message and return a structured intent object.

USER MESSAGE: "{{message}}"

LEARNER CONTEXT:
- Current goal: {{learner.goal}}
- Last session: {{learner.lastSessionDate}}
- Active teacher: {{learner.currentTeacher}}

Return JSON only. No explanation. No markdown.

{
  "primary_intent": "book_session" | "get_match" | "prep_session" | "review_progress" | "ask_question" | "give_feedback" | "change_goal" | "other",
  "urgency": "immediate" | "within_24h" | "flexible",
  "emotional_tone": "neutral" | "excited" | "frustrated" | "uncertain" | "grateful",
  "entities": {
    "teacher_mentioned": "string | null",
    "topic_mentioned": "string | null",
    "time_mentioned": "string | null"
  },
  "requires_clarification": true | false,
  "clarification_question": "string | null — only if requires_clarification is true. One question, max 12 words."
}
```

---

## Skill 02: SESSION PREP BRIEF
**Trigger:** 24 hours before scheduled session

```
Generate a pre-session preparation brief for the learner.

SESSION DATA:
- Teacher: {{session.teacherName}}
- Topic area: {{session.topic}}
- Scheduled time: {{session.datetime}}
- Previous sessions with this teacher: {{session.previousCount}}
- Last session summary: {{session.lastSummary}}

LEARNER:
- Goal: {{learner.goal}}
- Outstanding action items: {{learner.actionItems}}
- Self-reported confidence in topic: {{learner.confidence}} / 5

Generate a brief with this structure (plain text, no markdown headers):

Paragraph 1 (2 sentences): What to focus on in today's session, grounded in their goal.
Paragraph 2 (1–2 sentences): One specific thing to bring up or ask.
Closing line: One sentence of mindset framing. Warm, not motivational-poster.

Tone: Calm, knowledgeable, personal.
Maximum length: 100 words total.
```

---

## Skill 03: POST-SESSION SYNTHESIS
**Trigger:** Session end event (within 60 seconds)

```
Generate a post-session synthesis for the learner.

SESSION TRANSCRIPT SUMMARY: {{session.conductorNotes}}
TOPICS COVERED: {{session.topicsCovered}}
ACTION ITEMS CAPTURED: {{session.actionItems}}
DURATION: {{session.duration}} minutes
TEACHER: {{session.teacherName}}

Write a synthesis in this exact format:

---
What you covered today
[2–3 sentences. Past tense. Specific — name the concepts, not just the category.]

What to do before next time
[Bullet list. Each item starts with a verb. Maximum 3 items. If none: "Nothing specific — just let today's session settle."]

A thought for next session
[1 sentence suggesting a natural next topic or question.]
---

Rules:
- Never say "great session."
- Action items must be specific enough to act on. Not "practice more" — "Try repricing your top 3 products using the margin formula we covered."
- The "thought for next session" should feel curious, not prescriptive.
```

---

## Skill 04: BIO GENERATOR
**Trigger:** Teacher profile setup or bio edit request

```
You are helping a teacher on Clario write their profile bio based on their answers.

TEACHER ANSWERS:
- What do you teach? {{teacher.topics}}
- What's your background? {{teacher.background}}
- What do learners usually get out of your sessions? {{teacher.outcomes}}
- How would you describe your teaching style? {{teacher.style}}
- Anything else? {{teacher.extra}}

Write a bio that:
- Feels written by a real person, not a platform template
- Is 3–4 sentences maximum
- Leads with who they are and what they're good at — not their job title
- Mentions one specific, concrete thing they help learners with
- Ends with something that communicates their teaching personality

Tone: Warm, specific, confident. No "passionate about" or "dedicated to."
Output the bio only. No explanation. No quotation marks.
```

---

## Skill 05: FEEDBACK DISTILLER
**Trigger:** After 3+ sessions (monthly cycle)

```
Analyze the following feedback responses and generate a digest.

FEEDBACK DATA (last 30 days): {{feedback.responses}}
TEACHER: Sessions: {{teacher.sessionCount}}, Topics: {{teacher.topics}}

Generate exactly 3 insights. Each must:
1. Be grounded in a specific pattern — not a single response
2. Be written in second person ("Learners consistently notice that you...")
3. Be constructive and specific
4. Be no longer than 2 sentences

Output:
{
  "insights": [
    {
      "theme": "2–3 word label",
      "observation": "the insight",
      "valence": "positive" | "constructive"
    }
  ],
  "overall_signal": "green" | "amber" | "red",
  "headline": "1 sentence summary — honest, not softened"
}

Rules:
- If fewer than 3 clear patterns exist, return what you have — do not fabricate.
- Never frame an insight as a criticism. Always as an observation.
```

---

## Skill 06: RESOURCE CURATOR
**Trigger:** Immediately post-session

```
Based on this session's content, suggest 2 resources for the learner.

SESSION TOPICS: {{session.topicsCovered}}
LEARNER GOAL: {{learner.goal}}
LEARNER LEVEL: {{learner.level}}
ACTION ITEMS: {{session.actionItems}}

Output:
{
  "resources": [
    {
      "type": "article" | "video" | "exercise" | "tool" | "book",
      "title": "Specific, real resource title",
      "why": "1 sentence: why this resource, connected to today's session",
      "time_required": "estimated minutes"
    }
  ]
}

Rules:
- Only suggest real, verifiable resources.
- Resources should extend today's session — not repeat it.
- Maximum 2 resources. One is fine if only one is genuinely useful.
- The "why" must reference something specific from today.
```

---

## Skill 07: GOAL REFINER
**Trigger:** On goal input (onboarding or goal change)

```
Refine a learner's stated goal into a structured object.

RAW GOAL INPUT: "{{learner.rawGoal}}"
Level: {{learner.level}}
Time available: {{learner.timeAvailable}}
Deadline: {{learner.deadline}}

Output:
{
  "refined_goal": "Specific, measurable. Start with 'Be able to...' or 'Understand...' or 'Build...'",
  "goal_category": "technical" | "creative" | "business" | "communication" | "personal",
  "sub_topics": ["3–5 specific topic areas"],
  "suggested_session_count": number,
  "success_indicator": "How will the learner know they've achieved this? Concrete, observable.",
  "ambiguity_score": 0–10,
  "clarification_needed": true | false,
  "clarification_question": "string | null — only if score > 7"
}
```

---

## Skill 08: SCHEDULE OPTIMIZER
**Trigger:** On booking request

```
Optimize scheduling for a learner-teacher pair.

LEARNER AVAILABILITY: {{learner.availability}}
TEACHER AVAILABILITY: {{teacher.availability}}
LEARNER SESSION HISTORY: {{learner.sessionHistory}}
LEARNER TIME PREFERENCE: {{learner.timePreference}}

Find the best 3 options, ranked by fit:
{
  "options": [
    {
      "day": "string",
      "time_local_learner": "string",
      "time_local_teacher": "string",
      "fit_score": 0–100,
      "fit_reason": "1 sentence — why this slot works for this learner specifically",
      "recurrence_possible": true | false
    }
  ]
}

Ranking criteria:
1. Matches learner's stated time preference
2. Consistent with past session patterns
3. Not back-to-back with other sessions (30min gap minimum)
4. Teacher's highest-quality time slots

If no overlap:
{ "options": [], "conflict_note": "explanation", "suggested_resolution": "practical suggestion" }
```

---

## Skill 09: MATCH EXPLAINER
**Trigger:** Search results display, per teacher card

```
Generate a 1–2 sentence match explanation for a teacher recommendation.

LEARNER GOAL: {{learner.goal}}
LEARNER STYLE: {{learner.stylePreference}}
TEACHER NAME: {{teacher.name}}
TEACHER BIO: {{teacher.bio}}
TEACHER TOPICS: {{teacher.topics}}
TEACHER STYLE: {{teacher.teachingStyle}}
MATCH SCORE: {{match.score}}

Write as if Aria is speaking directly to the learner. Use "you."

Rules:
- Must reference something specific from both learner goal and teacher profile.
- Never use: "highly experienced," "great fit," "passionate teacher," "perfect match."
- Tone: warm, confident, specific. Not salesy.
- Maximum 2 sentences.
- If score < 60: acknowledge partial fit honestly.

Output the explanation only. No JSON wrapper.
```

---

## Skill 10: CANCELLATION HANDLER
**Trigger:** Cancellation event

```
A session has been cancelled. Generate appropriate responses.

CANCELLATION DATA:
- Who cancelled: {{cancellation.initiator}}
- Hours notice: {{cancellation.hoursNotice}}
- Session number in relationship: {{session.numberInRelationship}}
- Reason given: {{cancellation.reason}}
- User cancellation rate: {{user.cancellationRate}}

Generate three outputs:

1. MESSAGE TO OTHER PARTY
Tone by notice:
- >24h: Understanding, no inconvenience implied
- 12–24h: Acknowledging short notice, practical
- <12h: Empathetic but honest about impact

2. REBOOK NUDGE (sent 2 hours after cancellation)
Short, natural, references original topic. Not pushy.

3. INTERNAL ACTION JSON:
{
  "refund_eligible": true | false,
  "credit_applicable": true | false,
  "flag_for_review": true | false,
  "flag_reason": "string | null",
  "rebook_nudge_scheduled": true | false,
  "rebook_nudge_delay_hours": number
}
```

---

## Skill 11: SEARCH INTELLIGENCE
**Trigger:** Discovery search input

```
Transform a learner's raw search into structured search intent.

RAW QUERY: "{{query}}"
LEARNER CONTEXT: Goal: {{learner.goal}}, Level: {{learner.level}}, Past topics: {{learner.pastTopics}}

Output:
{
  "normalized_query": "Cleaned version",
  "primary_topic": "Main subject area",
  "secondary_topics": ["Related areas for fallback"],
  "implied_level": "beginner" | "intermediate" | "advanced" | "any",
  "implied_style": "structured" | "exploratory" | "project-based" | "any",
  "outcome_oriented": true | false,
  "outcome_description": "What the learner wants to DO",
  "suggested_display_label": "Short, friendly label above results",
  "zero_results_fallback": ["2–3 alternative queries"]
}
```

---

## Skill 12: PROFILE COACH
**Trigger:** Teacher enters profile edit mode

```
Analyze a teacher's Clario profile and suggest improvements.

PROFILE: Bio: {{teacher.bio}}, Topics: {{teacher.topics}}, Style: {{teacher.styleDescription}}
PERFORMANCE: Conversion: {{teacher.conversionRate}}%, Search position: {{teacher.avgSearchPosition}}, Top learner goal: {{teacher.topLearnerGoal}}

Output:
{
  "overall_assessment": "2 sentences — honest",
  "suggestions": [
    {
      "element": "bio" | "topics" | "style_description" | "session_structure",
      "issue": "What's weak — specific",
      "suggestion": "What to do — specific and actionable",
      "impact": "Why this improves conversion"
    }
  ],
  "quick_win": "Single highest-impact change — 1 sentence",
  "strong_points": ["1–2 things already working — specific"]
}

Maximum 3 suggestions. Never suggest changes that reduce authenticity.
```

---

## Skill 13: SESSION CLASSIFIER
**Trigger:** On booking intent / session setup

```
Classify the session type and configure parameters.

SESSION GOAL: "{{session.statedGoal}}"
SESSION NUMBER: {{session.number}}
PREVIOUS TOPICS: {{session.previousTopics}}
LEARNER LEVEL: {{learner.level}}

Output:
{
  "session_type": "intro" | "deep_dive" | "project_review" | "q_and_a" | "practice" | "planning",
  "recommended_duration": 30 | 45 | 60 | 90,
  "suggested_agenda": ["Item 1 (time)", "Item 2 (time)", "Item 3 if applicable"],
  "teacher_prep_note": "1 sentence",
  "learner_prep_note": "1 sentence",
  "success_condition": "How will both know this went well? 1 sentence."
}
```

---

## Skill 14: NOTIFICATION COMPOSER
**Trigger:** Any platform notification event

```
Compose a platform notification.

EVENT TYPE: {{event.type}}
EVENT DATA: {{event.data}}
RECIPIENT: {{recipient.name}}, role: {{recipient.role}}
CHANNEL: {{notification.channel}} — "push" | "email" | "in_app"

Output:
{
  "title": "Max 6 words, sentence case, specific",
  "body": "Notification body",
  "cta_label": "Max 4 words, action verb",
  "cta_action": "deep_link or action ID",
  "tone": "neutral" | "warm" | "urgent",
  "send_delay_minutes": number
}

Channel limits: push (title 50 chars, body 100), in_app (60/150), email (subject 60, body 2–4 sentences)

Tone rules: Reminders → neutral. Milestones → warm. Cancellations → neutral. Re-engagement → warm, never pressured. Billing → neutral.

Never use exclamation marks. Never manufacture urgency.
```

---

## Skill 15: QUALITY REVIEWER
**Trigger:** Post-session review cycle

```
Conduct a quality review of a completed session.

SESSION: {
  "session_id": "{{session.id}}",
  "duration_actual": {{session.durationActual}},
  "duration_scheduled": {{session.durationScheduled}},
  "learner_feedback": "{{session.learnerFeedback}}",
  "teacher_feedback": "{{session.teacherFeedback}}",
  "conductor_notes": "{{session.conductorNotes}}",
  "action_items_count": {{session.actionItemsCount}},
  "session_number": {{session.numberInRelationship}}
}

Output:
{
  "quality_score": 0–100,
  "score_rationale": "2 sentences — honest",
  "flags": [
    {
      "flag_type": "duration_overrun" | "duration_underrun" | "no_action_items" | "negative_learner_feedback" | "negative_teacher_feedback" | "goal_misalignment",
      "severity": "low" | "medium" | "high",
      "detail": "Specific plain language"
    }
  ],
  "learner_satisfaction_signal": "positive" | "neutral" | "negative" | "unclear",
  "teacher_satisfaction_signal": "positive" | "neutral" | "negative" | "unclear",
  "relationship_health": "strengthening" | "stable" | "at_risk",
  "recommended_follow_up": "none" | "aria_checkin" | "cleo_checkin" | "trust_review"
}
```
