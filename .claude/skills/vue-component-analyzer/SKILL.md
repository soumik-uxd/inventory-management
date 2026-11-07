---
name: vue-component-analyzer
description: Analyze a Vue 3 app's single-file components for performance problems and code-reuse opportunities, then produce a ranked report with file:line references and apply only the fixes the user picks. Use this skill when asked to audit, review, profile or optimize Vue components, find duplicated component logic, templates or styles, or check v-for keys, computed vs methods, and component size.
---

# Vue Component Analyzer

Measures every `.vue` file with the app's own `vue/compiler-sfc`. You then turn the numbers into a short ranked report and fix only what the user chooses.

This skill is narrower than a general "optimize the codebase" pass. It covers Vue component structure only: render cost, reactivity, reuse across components, and component size. It does not cover backend code, dependencies or bundle config.

Supporting files:
- `scripts/analyze.mjs`: the analyzer. It is read-only, and it needs no dependencies beyond the app's own Vue.
- `references/rules.md`: what each rule ID means, how to verify it, and the typical fix. Read it at Step 3.

## Ground Rules

1. **Report first, edit later.** Steps 1 to 4 change no files. Edit only after the user picks findings in Step 5.
2. **Project rules win.** Read the project's CLAUDE.md files first, at the root and in the app folder. Follow their required subagents (for example, one that must handle `.vue` edits), their component style (`export default { setup() }` vs `<script setup>`), their naming, and their known-issue lists. Where they conflict with this skill, follow the project.
3. **Verify before reporting.** The analyzer is static and heuristic. Open the source at every finding you put in the report, and drop or downgrade the false positives. Never report a raw analyzer line you haven't checked.
4. **No new dependencies.** Fixes use Vue and code that is already in the app. Don't add lodash or VueUse to fix a finding unless the user asks.
5. **Behavior-preserving fixes.** A performance or reuse fix must render the same output. Wiring a feature that was missing, such as an unregistered component that doesn't exist yet, is out of scope. Report it, and don't build it.
6. **Comment the non-obvious.** For example, why a computed replaced a method, why a key is a composite, or why a helper moved.

## Step 1: Discover

Find and note:
- The app root, meaning the folder whose `package.json` lists `vue`, and the source folder (usually `src`).
- The Vue version, and whether `node_modules` is installed. The analyzer needs `vue/compiler-sfc` from it. If dependencies aren't installed, ask before installing them.
- The component style in use, and the shared code locations (`utils/`, `composables/`, `helpers/`, `lib/`).
- Project rules from CLAUDE.md that affect fixes, such as the required subagent, key conventions, or pitfalls already listed.

## Step 2: Run the analyzer

From the app root:

```bash
node <path-to-skill>/scripts/analyze.mjs src          # readable report
node <path-to-skill>/scripts/analyze.mjs src --json   # full data for deeper checks
```

Options:
- `--min-block=N` sets the minimum number of elements for a duplicated template block (default 6).
- `--min-decls=N` sets the minimum number of CSS declarations for a duplicated style body (default 4).

Output:
- a component table: lines, template size, depth, props, emits, state, computed, functions and watchers
- the exported shared helpers it found
- findings sorted high, then medium, then low

## Step 3: Interpret

For each finding, open the source and check it against `references/rules.md`:
- Confirm it's real, and adjust its severity using context the analyzer can't see, such as list size, how often the code renders, and whether the list is static.
- **Group related findings into one item.** For example, an `index-key` and a `method-call` on the same list, or six `formatDate()` copies.
- Look at the size table for **structural** findings the rules don't emit on their own:
  - a view with many `ref`s and functions but no composable
  - a component with no props that hard-codes data it could receive
  - several modals with the same shell
- Note quick wins, where the fix is small and the effect is high, separately from refactors.

## Step 4: Report

Present one ranked list. Keep it scannable: no more than about 15 items, with the rest summarized by rule. Each item has:
- **Rank, severity, and a title.**
- **Where:** `file:line`, with every occurrence for reuse findings.
- **Why it matters:** one sentence on the concrete cost. For example, "recomputes 4 filters over all orders on every render", rather than "bad practice".
- **Fix:** one sentence, plus the target location of any extracted helper or component.
- **Effort:** S, M or L.

Rank by real impact:
1. correctness surfaced along the way (unresolved components, prop mutation, v-if/v-for bugs)
2. render cost
3. duplicated logic
4. duplicated markup and styles
5. size

End with:
- what you dropped as a false positive
- what the analyzer can't see (the Limits in `rules.md`)

## Step 5: Offer fixes

Ask the user which items to apply. Offer quick wins as a group. Then, for the items they chose:
1. Batch the edits by file, so that one agent pass covers each component.
2. Delegate `.vue` edits to the project's required subagent, if there is one. Pass it:
   - the exact findings and their line numbers
   - the component style to keep
   - the instruction to comment non-obvious changes
   - the instruction not to change behavior or styling beyond the fix

   Edit plain `.js` or `.ts` helpers directly, unless the project says otherwise.
3. When you extract a shared helper, put it in the existing `utils/` or `composables/` folder and match that folder's export style.

## Step 6: Verify

1. Re-run the analyzer. The fixed findings should be gone, and no new high findings should appear.
2. Run the project's build (`npm run build` or the project's equivalent). It must pass.
3. If the app can run, open the affected routes with the project's browser-testing tool. Confirm they render the same way and that lists still update when filters change. If you couldn't verify visually, say so.
4. Run the project's code-review agent on the diff, if it has one.
5. Report:
   - what was fixed, with before and after finding counts
   - files changed
   - helpers or components added
   - anything skipped and why
