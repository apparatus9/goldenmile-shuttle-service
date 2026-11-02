# Golden Mile Chrysler – Complimentary Shuttle Service page

Standalone landing page for the Golden Mile Chrysler Dodge Jeep Ram service shuttle, styled to match the dealership's Collision Centre page (orange palette, Archivo / Barlow fonts). All CSS and JS are scoped under `#gmss` so the page can be dropped into the WordPress site as an embed.

## Files

| File | Purpose |
| --- | --- |
| `shuttle-service-v2.html` | Current page, standalone (photo hero, timeline, service-area map, hours, FAQ, request form) |
| `wordpress-embed.html` | **Paste this into WordPress.** Generated. |
| `wordpress-embed-isolated.html` | Same page inside a shadow root. Generated. Fallback if the plain one comes out wrong. |
| `build-wordpress-embed.js` | Builds both embeds from `shuttle-service-v2.html` |
| `shuttle-service.html` | First version, kept for reference |
| `images/` | Hero photo, service-area map, community diagram |

## Before publishing

Search the page for `EDIT:` comments. Placeholders that need confirming:

- Service hours and last shuttle departure (`HOURS`, `LAST_DEP_OFFSET` at the bottom of the page)
- Service radius (`RADIUS_KM`) and the estimated drive times in the "popular stops" list
- Testimonial quote
- Form destination email (`GM_EMAIL`)
- The service-area image is a map screenshot; swap for a Google Maps embed before going live.

Open `shuttle-service-v2.html` in a browser to preview.

## Pasting into WordPress (eDealer)

`shuttle-service-v2.html` is a standalone page. Dropping its markup into a
WordPress page does not work on its own: the relative `images/` paths break,
the `html, body` reset fights the theme, `<main>` collides with the theme's
own landmark, and the script assumes it runs at the bottom of a fresh
document.

**`wordpress-embed.html` is the file to paste.** One file, generated from
`shuttle-service-v2.html` by `node build-wordpress-embed.js`. Rerun that after
any edit to the source page — do not hand-edit the embeds.

Paste the whole thing into **one Custom HTML block** (block editor) or the
**Text** tab of the Classic editor. Not the visual editor — it rewrites markup
and breaks the layout. Use a full-width page template, and turn off the
theme's page title for this page: the hero carries the `<h1>`.

### What the build changes

- Drops `<!DOCTYPE>`/`<html>`/`<head>`/`<body>` and the global `html, body`
  reset. Collapses `<main>` to a `<div>`.
- Prepends a defensive reset inside `#gmss` so the theme cannot reach in —
  img borders, list bullets, uppercase headings, heading underlines, form
  control chrome.
- Marks our own declarations `!important` (1022 of them) across the properties
  that measurably moved under a hostile theme. Namespacing stops a theme's
  class rules matching our markup, but it has no answer to an `!important` on
  a plain element selector, and page builders emit
  `#main p { font-size: 24px !important }` from their typography settings.
  Relative order inside our own stylesheet is unchanged, so the media queries
  still win over the base rules exactly as before.
- Doubles the id on the five rules that target the wrapper itself — `#gmss`
  is `(1,0,0)` and the wrapper is a div inside the theme's `#main`, so
  `#main div { font-size: 24px !important }` at `(1,0,1)` out-specifies it and
  24px inherits into the whole page. `#gmss#gmss` is `(2,0,0)`. Rewriting the
  author's own rules rather than adding a hard-coded block is what keeps the
  `@media` step-down to 16px and the print rule working.
- Repeats the protective values at element specificity as well as on `*`. The
  universal selector is only `(1,0,0)`; a theme's `#main section` is `(1,0,1)`
  and beats it even when both carry `!important`.
- Pins `width`/`height` `!important` on the six rules that size an svg. An
  inline `<svg>` has no intrinsic size, so `svg { width: 100% }` resizes every
  icon, and the seven inline svgs also get explicit `width`/`height`
  attributes so a CSS failure cannot blow one up.
- Resolves `rem` to px. This page currently has none, but a theme setting
  `html { font-size: 62.5% }` would silently rescale any that get added.
- Renames the three state classes (`is-on`, `is-in`, `is-closed`) to `gm-is-*`.
  Everything else was already `gm-`/`gmss-` prefixed.
- Points the three images at jsDelivr. **Only works while this repo is
  public** — upload them to the Media Library and search the embed for
  `GM-IMG` to swap the urls for a permanent setup.
- Removes our own header and the utility strip, and the footer. The site has
  all three. A slim dark bar replaces them carrying `Shuttle Service` and the
  phone number, matching the Bodyshop bar on the Collision Centre embed.

### Full-bleed

The block bleeds out of the theme's content column to full viewport width, so
use a full-width (no sidebar) page template. To keep it inside the column
instead, delete the single line marked `FULL-BLEED` in the `<style>` block —
the script checks that rule and follows suit. With a sidebar the column is not
centred, so the script measures and corrects rather than trusting
`calc(50% - 50vw)`.

### If the hours table is empty and the form does nothing

The `<script>` was stripped. WordPress removes it for users without
`unfiltered_html`, and some security plugins remove it for everyone. Either
put the embed in a snippet plugin (WPCode, Code Snippets) scoped to that page,
or keep the markup in the Custom HTML block and move the script into the child
theme's `wp_footer`.

### wordpress-embed-isolated.html

The same page rendered inside a **shadow root**. Theme CSS cannot select into
one at all, so the only thing crossing the boundary is inherited properties,
which `:host { all: initial }` clears. The markup also sits in a `<template>`
on a single line, so `wpautop` has no blank line to split on and cannot insert
`<p>` tags into the grids.

Use it if the plain embed comes out wrong. Trade-offs: it needs JavaScript,
and the copy lives in the shadow tree rather than the page's own DOM — Google
renders with Chrome and indexes shadow content, but if this page has to rank,
prefer the plain embed.

### Measured

Both embeds were pasted into a deliberately hostile stand-in theme and
measured against the standalone page: `* { font-family: serif }`, 24px
`!important` on every text element, uppercase headings with `::after`
underlines, bulleted list arrows, bordered images, `svg { width: 300px
!important }`, 54px inputs with inset shadows, a sticky `z-index: 9999`
header, and `#main div, #main section, #main ul { display: block !important }`
— the rule that collapses every grid in the design. Run at five root font
sizes (62.5%, 10px, 16px, 20px, 24px) and five viewports (390, 600, 900, 1100,
1440), measuring ~70 selectors across 35 computed properties.

| Build | Differences from standalone | Console errors |
| --- | --- | --- |
| `wordpress-embed.html` | 360 | none |
| `wordpress-embed-isolated.html` | 210 | none |

All 210 of the isolated build's differences, and 210 of the plain build's 360,
are the same thing: sub-pixel column rounding in the hours table, under 1px,
where the rounded pixel widths still match. The plain build's remaining 150 are
accumulated height on three container elements from that same rounding.

Worth knowing: the plain embed survives the `display: block !important` grid
killer only because `display` is in the pinned property list. The Collision
Centre build pins just `font-size` and `font-family`, and its README records
101 differences against that rule — that gap is the pinning, not the shadow
root.
