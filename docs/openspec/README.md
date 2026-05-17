# LLM4Writing OpenSpec

This directory contains an OpenSpec-style mirror of the current implementation specification.

`docs/SPEC.md` remains the canonical implementation specification for this repository. The files under `docs/openspec/` translate the same current behavior into behavior-first requirements and scenarios so future feature work can be planned, reviewed, and verified in a more granular format.

## Directory Layout

```text
docs/openspec/
├── README.md
├── config.yaml
└── specs/
    ├── api/
    │   └── spec.md
    ├── auth-security/
    │   └── spec.md
    ├── learning-workflow/
    │   └── spec.md
    ├── platform/
    │   └── spec.md
    └── teacher-admin/
        └── spec.md
```

## Conventions

- Requirements describe current, verifiable behavior using `SHALL` or `MUST`.
- Scenarios use `GIVEN / WHEN / THEN` acceptance checks.
- Implementation details belong in `docs/SPEC.md` unless they are required to verify visible behavior or a durable contract.
- If future behavior changes, update `docs/SPEC.md` and the affected OpenSpec domain in the same change whenever possible.

## Source Mapping

| OpenSpec domain | Main source sections in `docs/SPEC.md` |
|---|---|
| `platform` | 1, 2, 4, 8, 9, 11, 12, 13, 14 |
| `learning-workflow` | 5, 6.5 |
| `auth-security` | 3, 7.0, 7.1, 10 |
| `api` | 7 |
| `teacher-admin` | 6.6, 6.7, 7.4, 7.5 |

