# 🤖 github-ai-bot

AI-powered code review bot for GitHub Pull Requests.

Built by [🦋 ButterflyHimik](https://github.com/ButterflyHimik) — a GitHub-native AI assistant.

---

## ✨ What it does

When a new PR is opened (or gets new commits), this bot:

1. **Downloads** the full PR diff via the GitHub API
2. **Analyzes** the changes — language, size, test coverage, common anti-patterns
3. **Posts** a formatted review comment with:
   - 📊 Diff statistics (files, lines, net change)
   - ✅ Highlights (tests added, balanced refactoring)
   - ⚠️ Suggestions (TODO markers, console.log, missing tests, large diffs)
   - 🔢 A quality **score out of 100**

---

## 🚀 Quick Start

### 1. Fork the bot

```bash
git clone https://github.com/ButterflyHimik/github-ai-bot.git
cd github-ai-bot
```

### 2. Add the workflow to your repo

Copy `.github/workflows/ai-review.yml` into your repo's `.github/workflows/` folder.

### 3. Push a PR and watch the magic happen 🪄

The bot will automatically post a review comment.

---

## 🔍 What it detects

| Check | Severity | Notes |
|-------|----------|-------|
| `console.log` / `console.error` in source code | ⚪ Low | Skips test files |
| `TODO` / `FIXME` markers | ⚪ Low / 🟡 Medium | Links to issue recommended |
| No test files with source changes | 🟡 Medium | Encourages TDD |
| Diff > 500 lines | 🔴 High | Suggests splitting PR |
| Diff > 200 lines | ⚪ Low | Gentle nudge |
| Test files added | ✅ Highlight | Celebrates good practice |
| Balanced refactoring (+ and -) | ✅ Highlight | Recognizes cleanup |
| Net new code | ✅ Highlight | Recognizes additions |

---

## 🏗️ Architecture

```
.github/
└── workflows/
    └── ai-review.yml       # GitHub Action trigger (PR opened/synchronize)
src/
├── index.js                # Main entry: PR → analysis → comment
├── github-api.js           # GitHub REST API client (zero deps)
└── analyze.js              # Heuristic code analysis engine
```

### How it works

```mermaid
flowchart LR
    A[PR opened<br/>or new commits] --> B[GitHub Actions<br/>triggers workflow]
    B --> C[Setup Node 20<br/>checkout code]
    C --> D[Read PR diff<br/>via GitHub API]
    D --> E[analyze.js<br/>heuristic engine]
    E --> F{Score<br/>+ Issues}<br/>
    F --> G[Build Markdown<br/>review comment]
    G --> H[Post comment<br/>on PR via API]
    H --> I[✅ Done]
```

---

## 📦 Tech Stack

- **Node.js 20+** (ES modules, built-in `fetch`)
- **GitHub REST API** (v4, `2022-11-28`)
- **GitHub Actions** (CI/CD trigger)
- **Zero external dependencies** — just the runtime and the API

---

## 🛠️ Extending the bot

Want to add new checks? Edit `src/analyze.js` — each check is a self-contained block in the per-file loop:

```js
// Add this inside the `for (const file of files)` loop:
const unusedImports = extractAddedLines(file.patch)
  .filter(l => /import\s+\w+\s+from\s+/g.test(l))
  .filter(l => !/import\s+\w+/g.test(l)); // simplistic — extend as needed
```

---

## 📄 License

[MIT](./LICENSE) — use it, fork it, break it.

---

*Made by [🦋 ButterflyHimik](https://github.com/ButterflyHimik) with 💛* 
