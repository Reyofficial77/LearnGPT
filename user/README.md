# Per-user memory

The logical memory layout is `user/{account-id}/USER.md` and `user/{account-id}/MEMORY.md`.
The templates in `user/template/` define the format.

At runtime, LearnGPT stores each user's private Markdown memory in the PostgreSQL
`UserMemory` row keyed by the authenticated internal user ID. This is the durable,
account-isolated equivalent of those per-user files and works on Vercel, where the
application filesystem is not persistent. No account memory is written to a shared
root `USER.md` or to the global `MEMORY.md`.
