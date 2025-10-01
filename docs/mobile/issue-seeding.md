# Initial Issue Seeding Guide

Use GitHub CLI to bootstrap issues once repo exists.

```sh
gh issue create --title "Epic: Auth & Session Handling" --body-file docs/mobile/project-board.md --label epic
```

Recommended issues (convert to JSON for scripted creation):

```json
[
  {
    "title": "Epic: Auth & Session Handling",
    "body": "Track Expo auth flow, token storage, VRM MFA messaging.",
    "labels": ["epic"]
  },
  {
    "title": "Epic: EG4 Dashboard & History",
    "body": "Implement EG4 cards, charts, history views matching web parity.",
    "labels": ["epic"]
  },
  {
    "title": "Feature: Scaffold Expo project & tooling",
    "body": "Initialize Expo TS app, configure lint/test/typecheck, add Husky.",
    "labels": ["feature"]
  },
  {
    "title": "Tech Task: Generate API client from FastAPI OpenAPI",
    "body": "Set up OpenAPI extraction script and generate TypeScript clients into packages/api-client.",
    "labels": ["tech-debt"]
  }
]
```

Bulk creation helper:

```sh
cat issues.json | jq -c '.[]' | while read -r issue; do
  title=$(echo "$issue" | jq -r '.title')
  body=$(echo "$issue" | jq -r '.body')
  labels=$(echo "$issue" | jq -r '.labels | join(",")')
  gh issue create --title "$title" --body "$body" --label "$labels"
done
```

After creation, link each epic to the GitHub Project board and add child issues via task lists.
