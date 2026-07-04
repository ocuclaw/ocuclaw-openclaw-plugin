---
name: glasses-ui
description: Authoring guide for render_glasses_ui surfaces on Even G2 glasses. Load BEFORE building any live/refreshing surface, per-item detail list, or multi-screen flow — covers the capability-tier ladder (system-stats host metrics, http data), the patch/replace/push moves and exit-to-chat policy, recipe recon, per-item {label,body} templates, and worked examples.
user-invocable: false
---

# Authoring glasses surfaces with `render_glasses_ui`

`render_glasses_ui` paints an interactive surface on the user's Even G2 HUD instead of a text reply. Think in two verbs: the render **paints** (the surface lives on glass, ticking, until the user exits or its refresh budget ends) and the call carries **one one-shot listen** (a bounded window in which a tap resolves your call live). The paint outlives the listen by design. This skill is the source of truth for **authoring** surfaces; the tool description is deliberately lean.

## Before you author: is the tool loaded?

`render_glasses_ui` is a plugin tool, and depending on the host runtime it may not sit in your initial tool list:

1. **Not listed but searchable** — some runtimes (e.g. the Codex harness) defer OpenClaw dynamic tools behind tool search. Search your available/deferred tools for `render_glasses_ui` (it surfaces under the `openclaw` namespace), load it, and proceed.
2. **Not findable at all** — the host's tool policy is filtering plugin tools. Newer OpenClaw versions (2026.6+) default `tools.profile` to `"coding"`, a base allowlist that strips plugin-owned tools; skills are not policy-filtered, which is why you can read this guide for a tool you cannot call. Don't improvise a workaround: tell the user to run `openclaw config set tools.alsoAllow '["ocuclaw"]' --strict-json` (merging `"ocuclaw"` into any existing `alsoAllow` list rather than overwriting) and restart the gateway, then try again.

## Surface kinds

| kind | use it for | caps |
|---|---|---|
| `text_surface` | one formatted read-only block | body ≤ 1000 chars; optional `title` ≤ 64 |
| `list_surface` | a short pickable list, label-only | ≤ 20 items × ≤ 64 chars |
| `list_with_details_surface` | a pickable list where each item carries a detail body shown as the user scrolls | label ≤ 64, body ≤ 200; total of all bodies ≤ 6144 |

`list_with_details` items are `{ label, body }` objects (`label` required, `body` optional). A bare string is treated as a label-only item. Use it when each option needs a 1–2 sentence compare-before-choosing detail — all bodies ship in one call, so the user browses with zero round-trips.

## Capability tiers — pick the lowest tier that answers the need

The refresh recipe runs at a capability tier. **Always pick the lowest tier that answers the need.**

- **L0 — `http` (data APIs).** In-process, SSRF-guarded fetch → template → surface. For pure data: scores, status APIs, quotes, weather. **Not currently enableable on this install:** `http` is gated by `glassesUiLive.httpEnabled`, and that opt-in isn't reachable yet (the plugin's config-schema omits the `glassesUiLive` block — tracked as a separate fix). Until that lands, an `http` refresh is **rejected (refresh disabled)** — do not author one expecting it to run. It is documented here so you know the tier exists and is the right pick once enabled.
- **L0′ — `system-stats` (host metrics).** Built-in, in-process `node:os` reader (RAM/CPU/load). **No operator gate** — governed only by the master `glassesUiLive.enabled` (on by default). **This is the only refresh tier that runs without operator config today.** Reach for it for anything host-metric.
- **Reasoning / judgment tier (`agent`, L1/L2) — designed, not yet available.** A future tier where a sandboxed subagent interprets a page or local files on a timer. It is design-gated (credential-isolation + containment spike) and **not built** — there is no `agent` recipe kind. For a surface that needs interpretation *right now*, render it **once from your own turn** (compose the content yourself, render a static `text_surface`/list). A *self-refreshing* reasoning surface needs an agent in the loop, which isn't wired yet; a live reasoning tier is coming.

### `system-stats` output fields (the `{{path}}` sources)

`memTotalMb`, `memUsedMb`, `memFreeMb`, `memUsedPct`, `cpuPct`, `loadAvg1`. Optional recipe param `sampleWindowMs` (50–1000, default 200) sizes the CPU-sample window.

## The four moves

`render_glasses_ui` takes an optional `update` telling it how this render relates to the current surface. **Default is `replace`.**

| move | what it does | when |
|---|---|---|
| `patch` | edit *some fields* of the current screen; the refresh cron **keeps ticking** | a partial in-place edit |
| `replace` *(default)* | swap the *whole content* of the current screen in place; **no back-target** | new content, no going back |
| `push` | stack a *new child screen*; the parent is retained and **its cron pauses** (resumes on Back) | new content, the user can go back |
| exit to chat | *not a param* — just end your turn with a short text reply; the chat screen takes over and the surface disappears | you're done; respond in chat |

**One-line rule:** partial edit → `patch`; new content, no going back → `replace`; new content, can go back → `push`; done → exit to chat.

**Exit-to-chat policy:** on a *deliberate* exit (the user backs past the root, or you're finished), the default is to **respond in chat and not reflexively re-surface**. You retain the capability to surface again later in the conversation — just don't bounce a new surface up reflexively. On an *in-stack* Back (depth ≥ 2), the client transparently restores the parent and its cron resumes; you don't need to re-render it.

> **Don't preempt yourself.** Omitting `update` means `replace` — it swaps your current surface in place. To drill into a detail *without losing the list*, use `push`. (Back restores the parent **surface** and re-fires its cron; it does not restore list scroll position.)

## Live refresh: recipe recon (validate-then-commit)

Add a `refresh` block to make a surface self-update: `{ recipe, intervalMs, targets, onError?, maxDurationMs?, maxConsecutiveFailures? }`. `intervalMs` ≥ 1000.

When you submit a render carrying `refresh`, the plugin runs an **initial smoke-test tick before the surface commits**. If that tick fails, the call resolves with `result: "recipe_failed"` and a `failureReason` string — **read it, fix the recipe, and retry**; the surface and cron only start on success. This is your recon loop: don't guess twice, read the failure.

`targets` maps recipe output → display:
- `targets.body` — a string template for `text_surface`.
- `targets.items` — an array of templates for list surfaces; each entry is either a string (label-only) or `{ label, body }`. The **whole array** is emitted each tick. **Labels are templated too**, so keep static labels as plain literals (no `{{…}}`) — only put `{{…}}` in the parts that should change.

### Template filters

`{{path}}` reads a value (`{{output}}` for the raw recipe output). Chain filters left-to-right:

`trim` · `upper` · `lower` · `int` · `round:N` · `percent` (×100, append %) · `truncate:N` · `default:"--"` · `prefix:"+"` · `minus:previous.value` · `plus:previous.value`. Use `previous.*` paths for deltas vs the prior tick.

## Worked examples

### 1. Live host stats — `system-stats` text_surface (runs today)

```js
render_glasses_ui({
  kind: "text_surface",
  title: "Host",
  body: "RAM —  CPU —",
  refresh: {
    recipe: { kind: "system-stats" },
    intervalMs: 2000,
    targets: { body: "RAM {{memUsedPct | round:0}}%  CPU {{cpuPct | round:0}}%  Load {{loadAvg1 | round:2}}" }
  }
})
```

### 2. Live host stats — `system-stats` list_with_details (the canonical interactive example, runs today)

```js
render_glasses_ui({
  kind: "list_with_details_surface",
  items: [
    { label: "Memory", body: "—" },
    { label: "CPU",    body: "—" },
    { label: "Load",   body: "—" }
  ],
  refresh: {
    recipe: { kind: "system-stats" },
    intervalMs: 2000,
    targets: {
      items: [
        { label: "Memory", body: "{{memUsedMb}} / {{memTotalMb}} MB ({{memUsedPct | round:0}}%)" },
        { label: "CPU",    body: "{{cpuPct | round:1}}% busy" },
        { label: "Load",   body: "{{loadAvg1 | round:2}} (1-min avg)" }
      ]
    }
  }
})
// Labels are static literals (don't re-render); bodies tick every 2s.
```

### 3. `push` drill-down (don't preempt the list)

```js
// User highlights "Memory" and asks for detail → stack a child, keep the live list underneath.
render_glasses_ui({
  kind: "text_surface",
  title: "Memory detail",
  body: "Used … of … MB …",   // compose from what you know, or give the child its own system-stats refresh
  update: "push"
})
// The parent list's cron pauses while the child is up; on Back it staleness-resumes.
```

### 4. `http` data (designed; NOT enableable on this install — shown for completeness)

```js
// L0 http — DATA APIs. Requires operator opt-in glassesUiLive.httpEnabled, which is
// NOT currently reachable (config-schema gap). This will be REJECTED today — prefer system-stats.
render_glasses_ui({
  kind: "text_surface",
  title: "AAPL",
  body: "—",
  refresh: {
    recipe: { kind: "http", url: "https://api.example.com/quote/AAPL", jsonPath: "$.data" },
    intervalMs: 30000,
    targets: { body: "AAPL {{price}} ({{change | round:1 | prefix:\"+\"}})" }
  }
})
```

## The interaction window (the listen)

Every call carries **one one-shot listen**: the host waits **90 seconds by default** for the user to act, **up to 600000 ms (10 min) via the optional `timeoutMs` param**. Pass `timeoutMs: 300000–600000` when you expect the user to read or decide; omit it for fire-and-forget paints; never go below 60000 for anything interactive. The listen is **never renewed automatically** — re-rendering opens a fresh one.

When the listen ends without a tap you get a **non-terminal** `{ result: "window_expired", surface_still_live: true }`. **This is not an error and not a paint event** — the surface stays on glass and keeps ticking. From there:

- Taps now **park** (the user sees their tap acknowledged; nothing is lost). Re-render the same surface (`update: "patch"`) to collect parked taps in this run — chain a couple of these listens if you are actively waiting, then stop.
- Or simply **end your turn** — parked taps **wake you** (one agent turn per real parked gesture, delivered as a refs-only plugin notification; re-render to collect) or ride your next turn. Ending your turn with a surface parked is a normal, cheap state, not an abandonment.
- **Silence-as-consent**: the window doubles as a default-action deadline. Put the deadline in the body copy ("Merging in 5 min unless you stop me"), give it a matching `timeoutMs`, and treat `window_expired` as consent.

Parked deliveries arrive annotated: `surfaceUuid`, `eventId`, `origin`, `actor`, `queuedAtMs`, `parkedForMs`. For taps that **actuate** something (sell/approve/unlock), declare `staleAfterMs` per render — a tap parked longer arrives with `stale: true`: treat it as a re-confirm prompt, **never** execute it as-is.

(The `await`/listen-without-repaint verb namespace is reserved for a future version — don't repurpose those words in surface copy or tooling.)

## Outcomes (the `result` you get back)

| result | meaning |
|---|---|
| `selected` | user picked a list item; `selected_index` + `selected_text` returned |
| `back` | user double-tapped above the root; they want to revise — re-render the previous step or pivot |
| `dismissed` | dismissed at root, or no selection made |
| `window_expired` | **non-terminal** — the listen ended, the surface is still live; taps park (see the interaction-window section) |
| `timeout` | terminal hygiene cap (rare); a refresh surface ends at `maxDurationMs` |
| `recipe_failed` | refresh only — initial smoke tick failed, the consecutive-failure breaker fired, or `onError:stop`; `failureReason` carries the last error |
| `glasses_disconnected` | refresh only — the glasses client dropped mid-cron |

Every delivery carries the surface's durable `surfaceUuid` plus `origin` (`gesture` for wearer actions, `system` for plugin-initiated outcomes) and an `actor` slot. Refresh results also carry: `ticks: { count, succeeded, failed, lastSuccessAt, lastFailureAt? }`, `lastBody`, `lastItems`, and `failureReason` (on `recipe_failed`).

## Quick reference

- Pick the **lowest tier**: host metrics → `system-stats`; pure data API → `http` (not enabled yet). Needs interpretation → render once from your turn.
- `update` default is `replace` (in-place). Use `push` to drill in without losing the parent; `patch` to edit fields while the cron keeps ticking.
- The listen is one-shot: default 90 s, `timeoutMs` up to 600000 (use 300000–600000 for read-or-decide). `window_expired` ≠ error — re-render to collect parked taps, or end your turn (they wake you / ride the next turn).
- `intervalMs` ≥ 1000. Read `failureReason` on `recipe_failed` and fix the recipe.
- After a surface resolves, a short text reply exits to chat; another render replaces; silence lets it linger.
