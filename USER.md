# USER.md — Per-account memory template

This document represents only the person signed in to the current LearnGPT account. Each account has its own copy stored in PostgreSQL; never share it with another account.

## What may be remembered

- Stable response preferences the user explicitly shares.
- Their learning level, subjects they are learning, and durable goals.
- Ongoing projects, tools, and non-sensitive working context that will make future help more relevant.
- Corrections the user asks LearnGPT to apply in future conversations.

## What must not be remembered

- Developer or product-owner information (that belongs in global `MEMORY.md`).
- Passwords, API keys, tokens, account numbers, or other credentials.
- Sensitive personal information such as health, religion, politics, race or ethnicity, sexual orientation, or precise location.
- Temporary details that will not help in future conversations, guesses, or facts inferred without clear support.

## Update rules

Learn from clear, durable facts the user shares during conversations, including stated preferences, learning goals, active projects, and corrections. Do not infer personal facts from writing style or one-off requests. An explicit request to remember something is also a strong signal. Keep it concise, factual, and written in Markdown. Remove outdated details when the user corrects them. If there is nothing durable to add, leave the memory unchanged.
