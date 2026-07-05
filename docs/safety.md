# Safety

This project is designed for local automation of the user's own browser session.

## Defaults

- Binds to `127.0.0.1` by default.
- Restricts remote UI CORS origins.
- Keeps Open Computer Use disabled unless explicitly enabled.
- Keeps arbitrary JavaScript evaluation disabled unless explicitly enabled.
- Writes a local JSONL audit log to `logs/audit.jsonl`.

## Automation Rules

- Do not bypass or solve CAPTCHA. If a CAPTCHA appears, stop and return `human action required`.
- Do not hide automation from websites.
- Do not steal, export, or print cookies, tokens, passwords, or session data.
- Do not scrape private data unless the user clearly asked and it is visible in their own browser.

## Confirmation Required

Ask the user before actions that send, submit, delete, purchase, upload, download, change account settings, or enter payment details.

## Kill Switch

Use `automation_pause` to pause commands, `automation_resume` to resume, and `automation_kill_switch` to stop automation until the server restarts.

## Dangerous Evaluation

`browser_execute_js` is disabled by default. Enable it only for trusted local debugging with:

```bash
ENABLE_DANGEROUS_EVAL=true npm run dev -w @chrome-automation/server
```
