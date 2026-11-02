/* Build paste-ready WordPress blocks from shuttle-service-v2.html.
 *
 * Same pipeline as the Collision Centre page's build, adapted for this page.
 * Two outputs:
 *   wordpress-embed.html           plain embed, light DOM
 *   wordpress-embed-isolated.html  same page inside a shadow root
 *
 * Rerun after any edit to shuttle-service-v2.html. Do not hand-edit the
 * outputs - they are generated.
 *
 *   node build-wordpress-embed.js
 */
const fs = require('fs'), p = require('path');

const SRC   = p.join(__dirname, 'shuttle-service-v2.html');
const SCOPE = '#gmss';
const CDN   = 'https://cdn.jsdelivr.net/gh/apparatus9/goldenmile-shuttle-service@main/images/';
const FONT_URL = 'https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700&family=Barlow:wght@300;400;500;600&display=swap';

const src = fs.readFileSync(SRC, 'utf8');

/* ---------- 0. pull the two halves out of the standalone page ---------- */
const css  = src.slice(src.indexOf('<style>') + 7, src.indexOf('</style>'));
let   body = src.slice(src.indexOf('<body>') + 6, src.lastIndexOf('</body>'));

/* ======================================================================
   CSS
   ====================================================================== */

/* This page's selectors are already written under #gmss and every class is
   already gm- prefixed, so the Collision Centre build's scoping and renaming
   passes have nothing to do here. The page-level reset is the exception: it
   targets html/body, which do not belong to us once embedded. Collapse it. */
let out = css.replace(/^html,\s*body\s*\{[^}]*\}\s*$/m, '');

/* A rem resolves against the ROOT element, and the root is the theme's <html>,
   which a page cannot set. A theme with html { font-size: 62.5% } would
   silently rescale the design. This page happens to use none, but resolve any
   that get added later. em is left alone - it resolves against the element's
   own font-size, which we do control. */
const REM = 16;
let remCount = 0;
out = out.replace(/(-?[\d.]+)rem\b/g, (m, n) => {
  remCount++;
  return +(parseFloat(n) * REM).toFixed(4) + 'px';
});

/* An inline <svg> has no intrinsic size, so a theme rule as ordinary as
   svg { width: 100% } resizes every icon, and with !important it wins
   outright. Pin width/height on every rule that sizes one. */
const SVG_RULE = /(^|\})([^{}]*(?:svg|__i\b|\.gm-i\b)[^{}]*)\{([^}]*)\}/g;
let svgPinned = 0;
out = out.replace(SVG_RULE, (m, pre, sel, rule) => {
  if (!/\b(width|height)\s*:/.test(rule)) return m;
  svgPinned++;
  return pre + sel + '{' + rule.replace(
    /(^|[;\s])(width|height)\s*:\s*([^;!}]+)(?=[;}]|$)/g,
    (mm, lead, prop, val) => `${lead}${prop}: ${val.trim()} !important`
  ) + '}';
});

/* Namespacing keeps a theme's class rules off our markup, but it has no answer
   to an !important on a plain element selector, and page-builder themes do emit
   rules like  #main p { font-size: 24px !important }  from their typography
   settings. Only !important beats !important. Relative order inside our own
   stylesheet is unchanged, so the media queries still win over the base rules
   exactly as before.

   Measured, not guessed: with only font-size and font-family marked, a theme
   carrying  #main p { line-height: 2.4 !important }  and
   #main section { border: 2px dashed !important }  still reached in. The list
   below is every property that actually moved under measurement.

   transition/animation are deliberately absent - the reveal stagger is set as
   an inline style from the script, and an !important rule would outrank it.
   width/height are absent for the same reason: the submit button carries
   style="width:100%". */
const PIN = [
  'font', 'font-size', 'font-family', 'font-weight', 'font-style',
  'line-height', 'letter-spacing', 'text-transform', 'text-decoration',
  'text-align', 'color', 'background', 'background-color', 'background-image',
  'border', 'border-top', 'border-right', 'border-bottom', 'border-left',
  'border-width', 'border-top-width', 'border-right-width',
  'border-bottom-width', 'border-left-width',
  'border-color', 'border-style', 'border-radius', 'box-shadow',
  'border-collapse', 'border-spacing', 'table-layout',
  'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'padding-block', 'padding-inline', 'margin-inline', 'margin-block',
  'display', 'gap', 'row-gap', 'column-gap',
  'grid-template-columns', 'grid-template-rows', 'grid-column', 'grid-row',
  'flex', 'flex-direction', 'flex-wrap', 'align-items', 'justify-content',
  'list-style', 'list-style-type', 'opacity', 'position', 'z-index',
  'white-space', 'overflow', 'max-width', 'min-height', 'text-indent',
];
let pinned = 0;
/* Anything added to the stylesheet later - the shuttle bar below - has to go
   through this too. Appending un-pinned CSS after the defensive reset means
   losing to it: the reset's  background: none !important  beat the bar's own
   dark background and the bar came out white text on white. */
function pin(css) {
  for (const prop of PIN) {
    css = css.replace(
      new RegExp(`([;{]\\s*)${prop}\\s*:\\s*([^;!}]+?)\\s*(?=[;}])`, 'g'),
      (m, pre, val) => { pinned++; return `${pre}${prop}: ${val} !important`; });
  }
  return css;
}
out = pin(out);

/* Double the id on every rule whose selector is the wrapper itself.
   #gmss alone is one id and no elements = (1,0,0), and the wrapper is a div
   inside the theme's #main, so a rule as ordinary as
   #main div { font-size: 24px !important }  is (1,0,1) and out-specifies it -
   24px then inherits into the whole page. #gmss#gmss is (2,0,0), out of reach
   of any single-id theme rule.

   Doing it by rewriting the author's own rules, rather than by adding one
   hard-coded block, is what keeps the page's internal cascade intact: the
   base rule, the  @media (max-width) { #gmss { font-size: 16px } }  step-down
   and the print rule all move up together. Hard-coding 17px here instead
   pinned the mobile layout at the desktop size. */
let doubled = 0;
out = out.replace(/(^|[}\n])(\s*)#gmss(\s*\{)/g,
  (m, pre, ws, post) => { doubled++; return `${pre}${ws}#gmss#gmss${post}`; });

/* The sticky header is removed from the embeds, but the rule survives in the
   stylesheet; make sure it can never fight the theme's own sticky header. */
out = out.replace(/position:\s*sticky;/g,
  'position: relative; /* was sticky - the theme has its own header */');

/* State classes are the only ones on the page that are not gm- prefixed, and
   .is-on / .is-in are generic enough for a theme to carry its own. Rename so
   no theme rule can match our elements at all. */
const STATE = { 'is-closed': 'gm-is-closed', 'is-in': 'gm-is-in', 'is-on': 'gm-is-on' };
for (const [from, to] of Object.entries(STATE)) {
  out  = out.replace(new RegExp(`\\.${from}\\b`, 'g'), '.' + to);
  body = body.replace(new RegExp(`(class="[^"]*?)\\b${from}\\b`, 'g'), `$1${to}`);
}

/* Goes BEFORE the stylesheet, deliberately low-specificity so every rule below
   still wins. Stops the theme's element styling reaching in. */
const DEFENCE = `
/* ---- defensive reset: keeps the theme out --------------------------- */
/* Every declaration here is !important, and so is every declaration in the
   real stylesheet below. That sounds extreme, but it changes nothing about
   our own internal cascade - the relative specificity of our rules is
   untouched, so our class rules still beat this universal one exactly as
   before. What it changes is the fight with the theme: an !important rule of
   theirs now only wins where it ALSO out-specifies us, and their selectors
   are #main <element> (1,0,1) against our #gmss <element> (1,0,1) with ours
   later in the document. We win the ties. */
${SCOPE} *, ${SCOPE} *::before, ${SCOPE} *::after {
  box-sizing: border-box !important;
  margin: 0 !important;            /* beats theme section/ul/table margins */
  padding: 0 !important;
  font-family: inherit !important; /* beats a theme-wide * { font-family }  */
  font-size: inherit !important;   /* beats a theme p { font-size }         */
  line-height: inherit !important; /* beats a theme p { line-height }       */
  border: 0 !important;
  border-radius: 0 !important;
  box-shadow: none !important;
  text-shadow: none !important;
  text-transform: none !important;
  letter-spacing: normal !important;
  background: none !important;     /* colour and image both                 */
  float: none !important;
  max-width: none !important;
  outline-offset: 0 !important;
  /* NOT min-width: 0. It looks harmless, but it removes the automatic
     minimum size of a flex item, and the map caption's nowrap button then
     shrinks below its own label (167px -> 135px). Themes almost never set
     min-width on content anyway, so there is nothing here worth the risk. */
}
/* The universal selector above is only (1,0,0), and a theme's #main <element>
   rule is (1,0,1) - it out-specifies us even when both carry !important, which
   is how  #main section { border: 2px dashed !important }  and
   #main p { margin: 0 0 2em !important }  were still getting through. Repeat
   the protective values at element specificity so the tie is decided on
   document order instead, and we are later. Our own rules are unaffected:
   they are (1,1,0) or better, and the real stylesheet comes after this block,
   so even an author rule at (1,0,1) still wins on order. */
${SCOPE} p, ${SCOPE} li, ${SCOPE} ul, ${SCOPE} ol, ${SCOPE} dl, ${SCOPE} dt, ${SCOPE} dd,
${SCOPE} div, ${SCOPE} section, ${SCOPE} article, ${SCOPE} figure, ${SCOPE} figcaption,
${SCOPE} span, ${SCOPE} a, ${SCOPE} strong, ${SCOPE} em, ${SCOPE} b, ${SCOPE} small,
${SCOPE} blockquote, ${SCOPE} label, ${SCOPE} form, ${SCOPE} fieldset,
${SCOPE} table, ${SCOPE} thead, ${SCOPE} tbody, ${SCOPE} tr, ${SCOPE} th, ${SCOPE} td,
${SCOPE} details, ${SCOPE} summary, ${SCOPE} img, ${SCOPE} svg, ${SCOPE} picture,
${SCOPE} h1, ${SCOPE} h2, ${SCOPE} h3, ${SCOPE} h4, ${SCOPE} h5, ${SCOPE} h6 {
  margin: 0 !important;
  padding: 0 !important;
  border: 0 !important;
  border-radius: 0 !important;
  box-shadow: none !important;
  background: none !important;
  line-height: inherit !important;
  letter-spacing: normal !important;
  text-transform: none !important;
  float: none !important;
  clear: none !important;
  text-indent: 0 !important;
}

${SCOPE} ul, ${SCOPE} ol, ${SCOPE} li { list-style: none !important; }
${SCOPE} ul li::before, ${SCOPE} ol li::before { content: none !important; }
${SCOPE} h1::after, ${SCOPE} h2::after, ${SCOPE} h3::after,
${SCOPE} h1::before, ${SCOPE} h2::before, ${SCOPE} h3::before { content: none !important; }
${SCOPE} blockquote::before, ${SCOPE} blockquote::after,
${SCOPE} q::before, ${SCOPE} q::after { content: none !important; }
${SCOPE} a { text-decoration: none !important; }
${SCOPE} table { border-collapse: collapse !important; border-spacing: 0 !important; width: auto !important; }
/* img only, matching the standalone page. Putting max-width on svg too would
   be a deviation, and the sized svg rules are already pinned !important. */
${SCOPE} img { max-width: 100% !important; }

/* Most of our text has no font-size of its own - it inherits from the wrapper -
   so there is no declaration for the build to mark !important, and a theme rule
   such as  #main p { font-size: 24px !important }  lands unopposed. Naming the
   elements matches that specificity, and the real stylesheet comes after this
   block, so our own rules still win the tie. */
${SCOPE} p, ${SCOPE} li, ${SCOPE} dt, ${SCOPE} dd, ${SCOPE} span, ${SCOPE} a,
${SCOPE} strong, ${SCOPE} em, ${SCOPE} b, ${SCOPE} small, ${SCOPE} blockquote,
${SCOPE} div, ${SCOPE} label, ${SCOPE} article, ${SCOPE} section, ${SCOPE} figure,
${SCOPE} figcaption, ${SCOPE} table, ${SCOPE} th, ${SCOPE} td, ${SCOPE} summary,
${SCOPE} details, ${SCOPE} input, ${SCOPE} select, ${SCOPE} textarea, ${SCOPE} button,
${SCOPE} h1, ${SCOPE} h2, ${SCOPE} h3, ${SCOPE} h4 { font-size: inherit !important; }

/* Form controls inherit nothing from the page by default, and themes restyle
   them heavily. Keep the native select/date/time widgets intact - resetting
   appearance on those removes the dropdown arrow and the pickers. */
${SCOPE} input, ${SCOPE} select, ${SCOPE} textarea {
  font-family: inherit !important;
  line-height: normal !important;
  height: auto !important;
  min-height: 0 !important;
  color: inherit !important;
  margin: 0 !important;
  padding: 0 !important;
  border: 0 !important;
  border-radius: 0 !important;
  box-shadow: none !important;
  background: none !important;
  text-transform: none !important;
  letter-spacing: normal !important;
}
/* width stays at normal weight on the button: the submit carries an inline
   style="width:100%", and an !important rule here would outrank it. */
${SCOPE} button {
  font-family: inherit !important;
  line-height: normal !important;
  height: auto !important;
  min-height: 0 !important;
  color: inherit !important;
  margin: 0 !important;
  padding: 0 !important;
  border: 0 !important;
  border-radius: 0 !important;
  box-shadow: none !important;
  text-shadow: none !important;
  background: none !important;
  text-transform: none !important;
  letter-spacing: normal !important;
  width: auto;
}
/* Fields only. A button's UA default is text-align: center, and the design
   relies on it; forcing left here would be a deviation from the standalone. */
${SCOPE} input, ${SCOPE} select, ${SCOPE} textarea { text-align: start !important; }
${SCOPE} button, ${SCOPE} input[type="submit"] { cursor: pointer !important; }
`;

/* Goes AFTER the stylesheet: the page's own #gmss rule carries margin: 0,
   which would otherwise cancel the full-bleed margins. */
const WRAPPER = `
/* ---- wrapper -------------------------------------------------------- */

/* Doubled id, for the reason given at the selector-doubling pass above:
   (2,0,0) is out of reach of a theme's #main div. */
${SCOPE}${SCOPE} {
  box-sizing: border-box;
  position: relative;
  isolation: isolate;   /* our z-indexes cannot fight the theme's header */
  float: none;
  text-align: left;
  overflow-x: clip;
}

/* FULL-BLEED. Lets the design escape the theme's content column.
   This page wants a full-width (no sidebar) page template.
   DELETE the next line to keep the block inside the column instead -
   the script at the bottom checks this rule and follows suit.          */
${SCOPE} { margin-left: calc(50% - 50vw); margin-right: calc(50% - 50vw); width: auto; max-width: none; }
`;

/* ======================================================================
   MARKUP
   ====================================================================== */

/* Drop our own header - logo and service-department lockup. The site already
   has a header; two on one page reads as a page inside a page. */
body = body.replace(/<!-- ={2,} HEADER ={2,} -->[\s\S]*?<\/header>\s*/, '');

/* And the utility strip above it - address on the left, phone on the right.
   The theme header carries both. The slim bar below replaces it with the one
   thing the theme does not say: that this page is the shuttle service. */
body = body.replace(/<!-- ={2,} UTILITY BAR ={2,} -->[\s\S]*?<\/div>\s*<\/div>\s*/, '');

/* The skip link targets our own main, which is no longer the page's main
   landmark, and the theme ships its own skip link. */
body = body.replace(/<a class="gm-skip"[\s\S]*?<\/a>\s*/, '');

/* <main> and <footer> are the theme's landmarks, not ours. The footer markup
   is dropped outright - the site has one. */
body = body.replace(/<!-- ={2,} FOOTER ={2,} -->[\s\S]*?<\/footer>\s*/, '');
body = body.replace(/<main id="gmss-main">/, '<div id="gmss-main">')
           .replace(/<\/main>/, '</div><!-- /#gmss-main -->');

/* The page script is replaced wholesale by the boot code below. It has to go
   before the wrapper div is stripped, or the trailing </div> is no longer at
   the end of the string and the anchored match below misses it. */
body = body.replace(/<script>[\s\S]*?<\/script>\s*$/, '').trim();

/* The outer wrapper div is re-emitted by the templates below. */
body = body.replace(/^\s*<div id="gmss">/, '').trim();
if (!/<\/div>$/.test(body)) throw new Error('expected body to end with the #gmss closing </div>');
body = body.replace(/<\/div>$/, '').trim();

/* Absolute image urls. Relative images/ paths cannot resolve from a WP page.
   This works only while the repo is public - upload the three files to the
   Media Library and swap these for a permanent setup. */
let imgCount = 0;
body = body.replace(/src="images\/([^"]+)"/g, (m, f) => { imgCount++; return `src="${CDN}${f}"`; });

/* Belt and braces: an <svg> with only a viewBox has no intrinsic size, so if
   the stylesheet ever fails to load it expands to fill its container. */
let svgSized = 0;
body = body.replace(/<svg ([^>]*?)viewBox="0 0 (\d+) (\d+)"/g,
  (m, pre, w, h) => { svgSized++; return `<svg ${pre}width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"`; });


/* A slim bar in place of the header we removed, matching the Bodyshop bar on
   the Collision Centre embed so the two pages read as one family. */
const BAR_CSS = `
/* ---- shuttle bar (embeds only) -------------------------------------- */
${SCOPE} .gm-sbar { background: var(--ink-deep); }
${SCOPE} .gm-sbar__inner {
  display: flex; flex-wrap: wrap; align-items: center;
  justify-content: space-between; gap: 8px 24px;
  min-height: 56px; padding-block: 10px;
}
${SCOPE} .gm-sbar__name {
  margin: 0;
  font-family: var(--ff-display) !important;
  font-weight: 700;
  font-size: 19.2px !important;
  letter-spacing: .08em;
  text-transform: uppercase;
  color: #fff;
}
${SCOPE} .gm-sbar__name b { color: var(--orange); font-weight: 700; }
${SCOPE} .gm-sbar__tel {
  display: flex; align-items: center; gap: 9px;
  font-family: var(--ff-display) !important;
  font-weight: 700;
  font-size: 18px !important;
  color: #fff;
  white-space: nowrap;
}
${SCOPE} .gm-sbar__tel:hover { color: var(--orange); text-decoration: none; }
${SCOPE} .gm-sbar__tel .gm-i { color: var(--orange); width: 1.15em !important; height: 1.15em !important; }
@media (max-width: 560px) {
  ${SCOPE} .gm-sbar__inner { justify-content: center; text-align: center; }
}
`;

const BAR_HTML = `<!-- ================= SHUTTLE BAR ================= -->
<div class="gm-sbar">
  <div class="gm-wrap gm-sbar__inner">
    <p class="gm-sbar__name">Shuttle <b>Service</b></p>
    <a class="gm-sbar__tel" href="tel:+16472885337">
      <svg class="gm-i" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3h3.6l1.8 4.5-2.3 1.6a12.5 12.5 0 0 0 6.8 6.8l1.6-2.3L21 15.4V19a2 2 0 0 1-2.2 2A16.8 16.8 0 0 1 3 5.2 2 2 0 0 1 5 3z"/></svg>
      <span>647-288-5337</span>
    </a>
  </div>
</div>
`;

out += pin(BAR_CSS);
body = BAR_HTML + '\n' + body.trim();

const STYLESHEET = `@import url('${FONT_URL}');\n${DEFENCE}${out}\n${WRAPPER}`;

/* ======================================================================
   wpautop-proofing.

   WordPress runs wpautop() over post content and turns every BLANK LINE
   into </p><p> - including blank lines inside an inline <style> or
   <script>. A CSS parser hitting a stray <p> discards tokens until it can
   resync at the next }, so one blank line costs roughly one rule. The
   readable build had 45 blank lines in its stylesheet, and on the live
   eDealer page that showed up as scattered dead rules: the hero overlay
   and the stops grid survived, .gm-eyebrow and .gm-btn did not.

   So: the stylesheet and the markup each go out as a single line, and the
   finished file carries no blank line anywhere. Collapsing the markup also
   stops wpautop inserting <p> tags between our grid children.

   This is why the paste is one long line. Do not "tidy" it by adding line
   breaks back - shuttle-service-v2.html is the readable copy, and this file
   is generated from it.
   ====================================================================== */

/* Safe for CSS and for our markup: no // line comments anywhere in either,
   and no <pre> or textarea whose whitespace matters. */
const flat = s => s.replace(/\r?\n\s*/g, ' ').replace(/[ \t]{2,}/g, ' ').trim();

/* For JavaScript, where collapsing to one line would also need the comments
   handled: just drop the blank lines, which is all wpautop reacts to. */
const noBlank = s => s.replace(/\r?\n[ \t]*(?=\r?\n)/g, '').replace(/\n{2,}/g, '\n');

/* ======================================================================
   BOOT SCRIPT - written once, parameterised by root so the same code runs
   against `document` in the plain embed and against the shadow root in the
   isolated one.
   ====================================================================== */
const initFn = `
function gmssInit(root, host) {
  /* ---------- EDIT: shuttle hours (24h clock). null = closed ---------- */
  var HOURS = [
    { d: 'Sun', open: null, close: null },
    { d: 'Mon', open: 7.5,  close: 17   },
    { d: 'Tue', open: 7.5,  close: 19   },
    { d: 'Wed', open: 7.5,  close: 17   },
    { d: 'Thu', open: 7.5,  close: 19   },
    { d: 'Fri', open: 7.5,  close: 17   },
    { d: 'Sat', open: 8,    close: 16   }
  ];
  var LAST_DEP_OFFSET  = 0.5;                              /* last departure = close minus 30 min */
  var GM_EMAIL         = 'service@goldenmilechrysler.ca';  /* EDIT: destination for the request form */
  var GM_SCROLL_OFFSET = 0;                                /* EDIT: px height of the theme's sticky header */
  var GM_ENDPOINT      = '';                               /* EDIT: optional POST url; empty = mailto */

  var wrap = root.getElementById ? root.getElementById('gmss') : null;
  if (!wrap) wrap = root.querySelector('#gmss');
  if (!wrap || wrap.getAttribute('data-gmss-ready') === '1') return;
  wrap.setAttribute('data-gmss-ready', '1');

  var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  function fmt(h) {
    var hh = Math.floor(h), mm = Math.round((h - hh) * 60);
    var ap = hh >= 12 ? 'PM' : 'AM', h12 = hh % 12; if (h12 === 0) h12 = 12;
    return h12 + ':' + (mm < 10 ? '0' + mm : mm) + ' ' + ap;
  }

  /* ---------- weekly hours table ---------- */
  var tbody = wrap.querySelector('#gmss-week tbody');
  if (tbody) {
    var NAMES = { Sun:'Sunday', Mon:'Monday', Tue:'Tuesday', Wed:'Wednesday',
                  Thu:'Thursday', Fri:'Friday', Sat:'Saturday' };
    var rows = '';
    [1,2,3,4,5,6,0].forEach(function (i) {
      var r = HOURS[i];
      rows += '<tr class="' + (r.open === null ? 'gm-is-closed' : '') + '">' +
              '<th scope="row">' + NAMES[r.d] + '</th>';
      rows += r.open === null
        ? '<td>Closed</td><td>&mdash;</td>'
        : '<td>' + fmt(r.open) + ' &ndash; ' + fmt(r.close) + '</td><td>' + fmt(r.close - LAST_DEP_OFFSET) + '</td>';
      rows += '</tr>';
    });
    tbody.innerHTML = rows;
  }

  /* ---------- request form ---------- */
  var f = wrap.querySelector('#gmss-form'), done = wrap.querySelector('#gmss-form-done');
  if (f) {
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!f.checkValidity()) { if (f.reportValidity) f.reportValidity(); return; }
      var v = function (n) { return f.elements[n] ? f.elements[n].value : ''; };
      var body = 'Shuttle request\\n\\nName: ' + v('first') + ' ' + v('last') +
                 '\\nPhone: ' + v('phone') + '\\nAppointment: ' + v('date') + ' at ' + v('time') +
                 '\\nTrip: ' + v('trip') + '\\nDestination: ' + v('dest') + '\\nNotes: ' + v('notes');
      var subject = 'Shuttle request - ' + v('first') + ' ' + v('last') + ' - ' + v('date');
      var mail = function () {
        window.location.href = 'mailto:' + GM_EMAIL + '?subject=' +
          encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
      };
      if (!GM_ENDPOINT) { mail(); if (done) done.classList.add('gm-is-on'); return; }
      var btn = f.querySelector('[type="submit"]'), label = btn ? btn.textContent : '';
      if (btn) { btn.disabled = true; btn.textContent = 'Sending\\u2026'; }
      var data = new FormData(f);
      data.append('_subject', subject);
      data.append('_to', GM_EMAIL);
      fetch(GM_ENDPOINT, { method: 'POST', body: data, credentials: 'same-origin' })
        .then(function (res) {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          f.reset(); if (done) done.classList.add('gm-is-on');
        })
        .catch(mail)
        .then(function () { if (btn) { btn.disabled = false; btn.textContent = label; } });
    });
  }

  /* ---------- scroll reveal ---------- */
  var secs = wrap.querySelectorAll('#gmss-main > section:not(.gm-hero), .gm-tl__step, .gm-opt, .gm-trust__item');
  if (secs.length && !reduce && 'IntersectionObserver' in window) {
    Array.prototype.forEach.call(secs, function (el, i) {
      el.classList.add('gm-reveal');
      var stagger = el.classList.contains('gm-tl__step') || el.classList.contains('gm-opt') ||
                    el.classList.contains('gm-trust__item');
      el.style.transitionDelay = (stagger ? (i % 4) * 90 : 0) + 'ms';
    });
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('gm-is-in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    Array.prototype.forEach.call(secs, function (el) { io.observe(el); });
  } else {
    Array.prototype.forEach.call(secs, function (el) { el.classList.add('gm-reveal', 'gm-is-in'); });
  }

  /* ---------- in-page anchors: smooth scroll past a sticky theme header ---------- */
  Array.prototype.forEach.call(wrap.querySelectorAll('a[href^="#"]'), function (a) {
    a.addEventListener('click', function (e) {
      var href = a.getAttribute('href');
      if (!href || href === '#') return;
      var t = wrap.querySelector('[id="' + href.slice(1) + '"]') ||
              document.getElementById(href.slice(1));
      if (!t) return;
      e.preventDefault();
      var top = t.getBoundingClientRect().top + window.pageYOffset - GM_SCROLL_OFFSET;
      if ('scrollBehavior' in document.documentElement.style) {
        window.scrollTo({ top: top, behavior: reduce ? 'auto' : 'smooth' });
      } else { window.scrollTo(0, top); }
    });
  });

  var yr = wrap.querySelector('#gmss-yr');
  if (yr) yr.textContent = new Date().getFullYear();

  /* ---------- full-bleed correction ----------
     calc(50% - 50vw) only lands correctly when the content column is centred
     in the viewport. With a sidebar it is not, so measure and correct. If the
     FULL-BLEED rule was deleted, marginLeft is >= 0 and we do nothing. */
  var el = host || wrap;
  if (parseFloat(getComputedStyle(el).marginLeft) < 0) {
    var bleed = function () {
      el.style.marginLeft = el.style.marginRight = '0';
      var r = el.getBoundingClientRect(), vw = document.documentElement.clientWidth;
      el.style.marginLeft  = Math.min(0, -r.left) + 'px';
      el.style.marginRight = Math.min(0, -(vw - r.right)) + 'px';
    };
    bleed();
    window.addEventListener('resize', bleed);
  }
}
`.trim();

/* ======================================================================
   OUTPUT 1 - plain embed
   ====================================================================== */
const plain = `<!--
  Golden Mile Chrysler - Complimentary Shuttle Service
  GENERATED by build-wordpress-embed.js - do not hand-edit.
  Source: shuttle-service-v2.html

  Paste this whole thing into ONE "Custom HTML" block (block editor) or the
  "Text" tab of the Classic editor. Not the visual editor - it rewrites the
  markup and breaks the layout.

  Use a full-width (no sidebar) page template, and turn off the theme's page
  title for this page - the hero carries the <h1>. To keep the block inside
  the theme's content column instead, delete the single line marked
  FULL-BLEED in the <style> below; the script checks that rule and follows.

  Hours, form destination, sticky-header offset and the optional POST endpoint
  are the EDIT: constants at the top of the script.

  If the hours table comes out empty and the form does nothing, the <script>
  was stripped - WordPress removes it for users without unfiltered_html, and
  some security plugins remove it for everyone. Use the isolated build, a
  snippet plugin, or move the script into the child theme's wp_footer.
-->
<style>${flat(STYLESHEET)}</style>
<div id="gmss">${flat(body)}</div>
<script>
(function () {
${noBlank(initFn)}
function go() { gmssInit(document, document.getElementById('gmss')); }
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go);
else go();
})();
<\/script>
`;

fs.writeFileSync(p.join(__dirname, 'wordpress-embed.html'), noBlank(plain), 'utf8');

/* ======================================================================
   OUTPUT 2 - isolated (shadow root)

   Everything above is a fight over one shared cascade: our rules and the
   theme's in the same document, and we win only where we out-specify it.
   There is always a theme rule specific enough to beat us -
   #main div { display: block !important } collapses every grid in the design,
   and no amount of scoping answers it. Theme CSS cannot select into a shadow
   root at all; the only thing that still crosses is inherited properties,
   which :host { all: initial } clears.

   Two things come free: the markup sits in a <template> on a single line, so
   wpautop has no blank line to split on and cannot insert <p> tags into our
   grids; and our CSS cannot escape either, so the defensive reset becomes
   belt and braces rather than load-bearing.

   Trade-offs: it needs JavaScript, and the copy lives in the shadow tree
   rather than the page's own DOM. Google renders with Chrome and indexes
   shadow content, but if this page has to rank, prefer the plain embed.
   ====================================================================== */
const oneLine = s => s.replace(/\r?\n/g, ' ').replace(/[ \t]{2,}/g, ' ').trim();

const shadowCss = `:host { all: initial; display: block; }\n` + DEFENCE + out + `\n${SCOPE} { box-sizing: border-box; position: relative; text-align: left; }\n`;

const HOST_STYLE = [
  'display:block', 'padding:0', 'border:0', 'background:none',
  'width:auto', 'max-width:none', 'float:none',
  /* FULL-BLEED: delete the two margins to keep it inside the theme's column */
  'margin-left:calc(50% - 50vw)', 'margin-right:calc(50% - 50vw)',
].join(';');

const shadowBoot = noBlank(`
${initFn}
(function () {
  var host = document.getElementById('gmss-host'), tpl = document.getElementById('gmss-tpl');
  if (!host || !tpl || host.shadowRoot) return;
  if (!document.getElementById('gmss-fonts')) {
    var l = document.createElement('link');
    l.id = 'gmss-fonts'; l.rel = 'stylesheet';
    l.href = '${FONT_URL}';
    document.head.appendChild(l);
  }
  var shadow = host.attachShadow({ mode: 'open' });
  shadow.appendChild(tpl.content.cloneNode(true));
  tpl.parentNode.removeChild(tpl);
  gmssInit(shadow, host);
})();
`.trim());

const isolated = `<!--
  Golden Mile Chrysler - Complimentary Shuttle Service (isolated build)
  GENERATED by build-wordpress-embed.js - do not hand-edit.

  Paste this whole thing into ONE "Custom HTML" block, or the "Text" tab of
  the Classic editor. The page renders inside a shadow root, so the theme's
  CSS cannot reach it and ours cannot reach the theme. Needs JavaScript.

  Use this build if the plain embed comes out wrong - it is immune to theme
  !important rules, and wpautop cannot insert <p> tags into it.

  Full-bleed is the two margin-* values in the host div's style attribute.
  Delete them to keep the block inside the theme's content column.

  Hours, form destination, sticky-header offset and the optional POST endpoint
  are the EDIT: constants at the top of the script.
-->
<div id="gmss-host" style="${HOST_STYLE}"></div>
<template id="gmss-tpl">${oneLine('<style>' + shadowCss + '</style><div id="gmss">' + body + '</div>')}</template>
<script>${shadowBoot}<\/script>
`;

fs.writeFileSync(p.join(__dirname, 'wordpress-embed-isolated.html'), noBlank(isolated), 'utf8');

console.log('rem values resolved to px     : ' + remCount);
console.log('declarations pinned !important : ' + pinned);
console.log('wrapper rules given doubled id  : ' + doubled);
console.log('css rules with svg sizing pinned : ' + svgPinned);
console.log('inline svgs given width/height : ' + svgSized);
console.log('images pointed at jsDelivr : ' + imgCount);
console.log('wrote wordpress-embed.html           ' + (plain.length / 1024).toFixed(1) + ' KB');
console.log('wrote wordpress-embed-isolated.html  ' + (isolated.length / 1024).toFixed(1) + ' KB');
