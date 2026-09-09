# `image_caption` — the one template that reaches the wire

Registry entry: **`image_caption@1`** in
[`template-registry.json`](template-registry.json) — `status: "shipped"`,
`lane: "registry_entry_only"`, `renderableToday: true`. It is the sole member of
`WIRE_TEMPLATE_FIELD_ENUM`: the only value the `template` field on a render accepts today.
Everything below is a reading of that entry plus the live validator; **the entry is the
source of truth**, so when a number here and a number there disagree, the artifact wins and
this file is stale.

## When to reach for it

One small greyscale image with **one** caption line under it: a welcome card, a rasterized
glyph, a diagram you already have as a PNG, a one-off picture.

It is an **image transfer, not a live surface**. There is no refresh, no cron, no selection.
If the thing you want is data that changes, you want a `text_surface` with a `refresh`
recipe, not this.

Reach for it when **the picture is the content**. If the picture is decoration on top of
text, drop the picture: a 64-character caption is the entire text budget of this template.

## Worked example — the built-in asset variant (runs today)

```js
render_glasses_ui({
  kind: "text_surface",
  template: "image_caption",
  body: "Welcome back",          // the caption, and the whole fallback on 2.0.0 clients
  imageAsset: "hermes_welcome"   // the only built-in asset id today
})
```

## Worked example — the inline PNG variant

```js
// One 96x96 PNG, base64 with NO data: URI prefix — raw standard base64 only.
render_glasses_ui({
  kind: "text_surface",
  template: "image_caption",
  body: "Build 412 — green",
  imageBase64: "iVBORw0KGgoAAAANSUhEUgAAAGAAAABg…",   // standard alphabet, no whitespace
  imageWidth: 96,                                      // MUST equal the PNG's IHDR width
  imageHeight: 96                                      // MUST equal the PNG's IHDR height
})
```

**`imageAsset` and the inline trio are exclusive.** Send one or the other — sending both, or
neither, is `image_source_invalid`. And the inline trio is a trio: `imageBase64` without its
two dimensions does not validate.

**The declared dimensions are checked against the file, not trusted.** The validator reads
the PNG's IHDR header and rejects a mismatch with `image_format_invalid`. Measure the image;
do not guess and let the caller find out.

## The budgets

Quoted from `image_caption@1` → `layoutBudgets.budgets`, in the artifact's own spelling:

```
captionMaxChars:       64
imageMinWidthPx:       20
imageMaxWidthPx:       288
imageMinHeightPx:      20
imageMaxHeightPx:      144
imageMaxDecodedBytes:  41472
imageMaxBase64Chars:   73728
imageFormat:           "PNG (IHDR-checked)"
```

**There are minimums, not just maximums.** A 5×5 PNG is rejected with
`image_dimensions_invalid` before its bytes are ever looked at — the dimensions must be
integers inside *both* bounds. Anything smaller than the minimum is not a small picture, it
is an unreadable one.

The decoded-bytes cap is the one that actually bites: 73728 base64 characters decode to more
than 41472 bytes, so a payload can pass the character cap and still be refused for size.
Budget the **decoded** PNG, and prefer few grey levels — the built-in asset is 16-level
greyscale in roughly 4 KB.

## Rejection codes, and what each one means

Every code below comes back on the render call itself, before anything paints. Read the
code, fix the spec, re-render — the same recon loop a failing `refresh` recipe gets.

| code | what tripped it |
|---|---|
| `invalid_template` | `template` was present but not `"image_caption"` |
| `image_template_required` | an image field was sent **without** `template: "image_caption"` |
| `image_caption_title_unsupported` | you sent a `title`. This template has one caption line and no title, ever |
| `image_caption_too_long` | `body` was empty, or longer than `captionMaxChars` |
| `image_caption_refresh_unsupported` | you attached a `refresh` block. One-shot only — re-render to change the picture |
| `image_source_invalid` | both `imageAsset` and inline image fields, or neither |
| `image_asset_unknown` | `imageAsset` is not one of the built-in ids |
| `image_dimensions_invalid` | `imageWidth` / `imageHeight` missing, non-integer, or outside the budgets |
| `image_payload_invalid` | `imageBase64` is not a string, exceeds `imageMaxBase64Chars`, is malformed base64, or decodes past `imageMaxDecodedBytes` |
| `image_format_invalid` | the bytes are not a PNG, or its IHDR dimensions disagree with the ones you declared |

`title_too_long` and `body_too_long` can also fire: the generic caps run *before* the
template branch, so a 200-character `title` reports `title_too_long` rather than
`image_caption_title_unsupported`. Same fix either way — remove the title.

## The trap: any retained title in the stack kills the card

Two mechanisms, each harmless alone:

1. The plugin **overwrites** a spec's `title` with the navigation breadcrumb whenever any
   surface in the session's live stack still holds a title.
2. The glasses client **refuses** any `image_caption` spec that carries a title.

Together they drop a perfectly valid image card on the client with **no render error on your
side** — your call returns fine and nothing paints.

Choosing a different move does not save you, because the breadcrumb is built from **retained**
titles and an untitled spec does not clear the one already on the surface. Driving the real
surface store gives this:

| what you do | breadcrumb the plugin injects | card survives? |
|---|---|---|
| the card is the **first** render of the stack | `null` | **yes** |
| `replace` at depth 1, current root was **untitled** | `null` | **yes** |
| `replace` at depth 1, current root **had a title** | that title | **no** |
| `replace` at depth 2+ under a titled ancestor | `"Trip › Hotels"` | **no** |
| `push` under a titled parent | `"Trip"` | **no** |

**The rule: render `image_caption` only at depth 1, and only when the current root carries no
retained title** — in practice, when the card is the first render of the stack.

`replace` is the move to use, and **only onto a depth-1 surface**. It is not an escape hatch
from a nested flow: at depth 2 or deeper the ancestors keep their titles no matter what you
send, so a `replace` there is dropped exactly like a `push`.

**If you are nested, get back to depth 1 first.** Let the wearer back out to the root, or end
the flow and rebuild — render the card as the first surface of a fresh stack. Do not try to
sneak it in mid-stack; there is no spec you can write that wins that fight.

## What you may claim afterwards

A successful call means the render was accepted and sent — `send_attempted`, whose honest
phrase is **"attempted, unconfirmed"**
([`delivery-ladder-phrases.md`](delivery-ladder-phrases.md)). The image bytes travel as a
**separate raw-data write after the container rebuild**, retried up to three times with a
growing backoff, so the picture landing is a second event you did not get told about.

Say "sent the card — attempted, unconfirmed", or say nothing. Never claim the picture is up.

One more mechanical fact worth knowing: the plugin's content summary carries the template
name, the asset id and the dimensions, and **never** the base64 payload — image bytes are
omitted from every summary surface by construction, not by redaction after the fact.
