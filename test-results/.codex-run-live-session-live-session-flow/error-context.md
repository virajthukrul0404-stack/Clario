# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: .codex-run\live-session.spec.js >> live session flow
- Location: .codex-run\live-session.spec.js:37:1

# Error details

```
Test timeout of 30000ms exceeded.
```

# Page snapshot

```yaml
- generic [ref=e1]:
  - generic [ref=e6]:
    - generic [ref=e7]:
      - paragraph [ref=e9]: Codex Teacher
      - generic [ref=e10]:
        - button "Mic off" [ref=e11] [cursor=pointer]
        - button "Cam off" [ref=e12] [cursor=pointer]
      - button "End session" [active] [ref=e13] [cursor=pointer]
    - generic [ref=e15]:
      - generic [ref=e16]: Chat
      - generic [ref=e18]:
        - generic [ref=e19]:
          - generic [ref=e20]: Codex Teacher
          - generic [ref=e21]: 8:05 PM
        - generic [ref=e22]: hello from teacher 1776522924910
      - generic [ref=e23]:
        - textbox "Type a message..." [ref=e24]
        - button "Send" [ref=e25] [cursor=pointer]
  - alert [ref=e26]
```