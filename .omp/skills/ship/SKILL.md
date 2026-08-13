---
name: ship
description: >
  Cut a release of @witooh/omp-provider-xai in one step — commit pending work,
  run package gates, bump the version, tag, push, and publish the GitHub
  release. Use when asked to ship, release, cut a version, or
  commit+push+tag+release in one go.
---

# Ship

One invocation from working tree to published GitHub release for
`@witooh/omp-provider-xai`. Argument selects the bump — `patch` (default),
`minor`, `major`, or an explicit `X.Y.Z`.

Run every step in order. Stop at the first failure and report which steps
already landed (push steps are not atomic — see [Partial failure](#partial-failure)).

## 1. Preflight

```bash
git rev-parse --abbrev-ref HEAD   # must be main
gh auth status
git status --short
git ls-remote --tags origin
gh release view "v$(node -p "require('./package.json').version")" 2>&1 | head -1
```

The current `package.json` version is often already tagged — the bump in step 5
makes room for this release. If the version you are about to ship already exists
on origin, bump higher; never force-move a published tag.

Read `git status --short` and decide per entry. Stage only what belongs to this
release:

```bash
git add <paths...>
```

`git add -A` is acceptable **only** when every listed entry belongs to the
release. Unrelated WIP, `.env*`, keys, tokens, logs, build output, or anything
large that `.gitignore` should have caught means stop and ask.

Required release paths when present:

- `package.json`
- `package-lock.json` (only if this release changed deps)
- `src/`
- `test/`
- `dist/` is **not** committed — built by `prepare` / install consumers
- `README.md`
- `tsconfig.json` / `tsconfig.test.json` / `biome.json` / `.gitattributes` / `.gitignore`
- `.omp/skills/ship/SKILL.md`

Confirm `dist/` stays gitignored (or untracked). Do not stage `node_modules/`.

## 2. Gates

```bash
npm run check   # tsc --noEmit for src and test
npx biome check .
npm test        # bun test
npm run build   # esbuild bundle -> dist/index.js
```

Also sanity-check the package surface the install channel consumes:

```bash
node -e '
const p = require("./package.json");
if (p.name !== "@witooh/omp-provider-xai") throw new Error("bad name: " + p.name);
if (!p.omp?.extensions?.includes("./dist/index.js")) {
  throw new Error("omp.extensions missing ./dist/index.js");
}
if (!p.files?.includes("dist") || !p.files?.includes("README.md")) {
  throw new Error("files[] must include dist and README.md");
}
const fs = require("fs");
if (!fs.existsSync("dist/index.js")) throw new Error("dist/index.js missing after build");
console.log("package.json ok", p.version);
'
```

A failing gate ends the ship — no commit, no bump, no tag.

## 3. Commit pending work

Skip when nothing was staged in step 1. Otherwise:

```bash
git commit -F - <<'EOF'
<imperative summary of what changed>

<why, and what a reader six months out needs>
EOF
```

Describe the change, not the release — the bump gets its own commit next. Every
content change must be committed **before** step 5, or the tag points at a
commit missing them. No AI attribution, no emoji.

## 4. Bump, commit, tag

```bash
# prefer bun when available (matches sibling packages); node/npm fallback:
if command -v bun >/dev/null 2>&1; then
  bun pm version <increment> -m "Release v%s"
else
  npm version <increment> -m "Release v%s"
fi
```

One command: rewrites `version` in `package.json`, commits `Release vX.Y.Z`
containing only that file (plus lockfile if the tool touches one), and creates
an **annotated** tag `vX.Y.Z` with the `v` prefix. Verify:

```bash
git show --stat HEAD
git cat-file -t "$(git rev-parse vX.Y.Z)"   # must print: tag
git describe --tags --abbrev=0
```

## 5. Push

```bash
git push origin main
git push origin vX.Y.Z
```

## 6. GitHub release

Notes from `git log <previous-tag>..vX.Y.Z --oneline`, grouped by what a user
sees — catalog fixes, install, docs — not one bullet per commit. Close with the
install block.

```bash
gh release create vX.Y.Z --title vX.Y.Z --notes-file - <<'EOF'
<notes>

## Install

```bash
omp plugin install github:witooh/omp-provider-xai
# or pin the tag:
omp plugin install github:witooh/omp-provider-xai#vX.Y.Z
```

Then start a **new** omp session (or re-select `xai-oauth/grok-4.6`).
EOF
```

## 7. Report

```bash
gh release view vX.Y.Z --json tagName,isDraft,url
git rev-parse HEAD
git rev-parse "vX.Y.Z^{commit}"
gh api "repos/witooh/omp-provider-xai/tarball/vX.Y.Z" --method HEAD
```

Report the tag, both commit shas (HEAD and tag target — must match), the
release URL, and that the tarball HEAD is 200. Remind: consumers need a **new
session** (or model re-select) after install/upgrade for the repaired catalog.

## Partial failure

Steps 5 and 6 are separate remote writes. When one fails, say exactly which
landed:

| Landed | Recovery |
| --- | --- |
| nothing pushed | delete the local tag (`git tag -d vX.Y.Z`), then report unpushed commits from `git log --oneline @{u}..` — steps 3–4 may have made **two** commits. Never `git reset --hard` unasked. |
| main pushed, tag not | re-run `git push origin vX.Y.Z` |
| tag pushed, release not | re-run `gh release create` with the existing tag |

Once a tag is pushed, never rewrite it — ship the next patch instead.

## Rules

- Tag moves only when created this session AND nothing meaningful could have
  fetched it (brand-new repo). Otherwise: new patch, never force-move.
- `npm publish` is **not** part of ship — only on explicit request
  (`prepublishOnly` runs check + build by itself).
- A failing gate stops the ship. Report the failure; do not tag around it.
- Docs must match code before anything is tagged (model claims, install channel,
  effort ladder wording in `README.md`).
