# Repository Guidelines

## Project Structure

- `index.html`: Main app (multi-class scoring system). Contains HTML, Tailwind classes, inline CSS, and the full JS app logic (including `localStorage` persistence).
- `punts.html`: Alternative/older single-class variant of the same idea (also self-contained).
- No build pipeline: dependencies are loaded via CDN (Tailwind, FontAwesome, Google Fonts, Marked).

## Development Commands

This is a static site. Use any static server to avoid `file://` browser restrictions:

```bash
python3 -m http.server 8000
# then open http://localhost:8000/
```

Useful checks:

```bash
git status
git diff
```

## Coding Style & Naming

- Indentation: keep the existing style (4 spaces in HTML/CSS/JS blocks).
- Keep code self-contained in the HTML files (no bundler assumed).
- UI text is primarily Catalan (`lang="ca"`). Keep new strings consistent and avoid mixing languages in the same UI.
- `localStorage` keys are part of the public “data format” (e.g. `esoClassesData`, `esoSettings`, `esoCategories`). If you change structure, add a migration path so existing data does not break.

## Testing Guidelines

- No automated tests currently.
- Manual test checklist (minimum):
  - Add/edit/delete class and students.
  - Score updates and history rendering.
  - Import/export (CSV/backup) flows.
  - Reload page and confirm data persists via `localStorage`.
  - Projection mode rendering on desktop and mobile widths.

## Commit & Pull Request Guidelines

- Commit messages in history are short and imperative (e.g. `Update index.html`). Keep them concise and specific: `Update index.html`, `Fix CSV export`, `Add projection filter`.
- Prefer PRs over direct pushes to `main`. Include:
  - What changed and why.
  - Screenshots for UI changes (before/after if applicable).
  - Browsers tested (at least Chromium/Firefox).

## Security & Configuration

- Do not commit API keys. Keep placeholders (e.g. `const apiKey = ""`) and document any required setup in the PR description.
