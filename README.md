# Golden Mile Chrysler – Complimentary Shuttle Service page

Standalone landing page for the Golden Mile Chrysler Dodge Jeep Ram service shuttle, styled to match the dealership's Collision Centre page (orange palette, Archivo / Barlow fonts). All CSS and JS are scoped under `#gmss` so the page can be dropped into the WordPress site as an embed.

## Files

| File | Purpose |
| --- | --- |
| `shuttle-service-v2.html` | Current page (photo hero, timeline, service-area map, hours, FAQ, request form) |
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
