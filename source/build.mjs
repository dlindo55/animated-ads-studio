import { playbackScript, initializePlayback } from './banner-playback.mjs';
import { saleBadgeContents } from './sale-badge.mjs';
import { writeFile, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const output = new URL('../banners/', import.meta.url);
const root = new URL('./assets/', import.meta.url);
const saleUrl = 'https://www.grayandsons.com/black-friday-deals/';

// Each box is [left, top, width, height] in CSS pixels.
const sizes = [
  { width: 728, height: 90, photo: [0, 0, 151, 90],
    watch: [10, 2, 131, 86], badge: [11, 15, 61, 60],
    headline: [166, 18, 140, 54.6], divider: [321, 12, 2, 66],
    savings: [337, 15, 130, 15.6], category: [337, 35, 132, 22.3],
    cta: [334, 62, 139, 21], brand: [510, 8, 174, 42.1],
    phone: [514, 54, 166, 27] },
  { width: 300, height: 600, photo: [0, 0, 300, 307],
    watch: [10, 8.5, 280, 290], badge: [10, 11, 89, 87.3],
    headline: [64, 319, 172, 67.1], divider: [20, 422, 260, 2],
    savings: [48, 393, 204, 24.5], category: [43, 432, 214, 36.2],
    cta: [22, 480, 256, 33], brand: [74, 520, 152, 36.8],
    phone: [58, 563, 184, 29] },
  { width: 300, height: 250, photo: [0, 0, 150, 250],
    watch: [4, 12, 142, 226], badge: [3.3, 3.3, 61.62, 60.45],
    headline: [169.8, 21.6, 110.7, 43.2], divider: [156, 102.6, 138, 1.8],
    savings: [168.9, 82.2, 112.2, 13.5], category: [167.4, 113.4, 115.2, 19.5],
    cta: [157.5, 143.4, 135, 23.1], brand: [167.1, 174, 115.8, 28],
    phone: [158, 214, 134, 24] },
];

const parts = ['watch', 'badge', 'headline', 'savings', 'category', 'cta', 'brand', 'phone'];
const textCopy = {
  headline: 'BLACK<br>FRIDAY',
  savings: 'BIG SAVINGS',
  category: 'LUXURY WATCHES &amp;<br>ESTATE JEWELRY',
  cta: 'SHOP THE SALE',
  phone: '305.615.2244',
};
const textScale = {headline: .46, savings: .82, category: .40, cta: .58, phone: .9};
const box = ([x, y, w, h]) => `left:${x}px;top:${y}px;width:${w}px;height:${h}px`;
const asset = name => new URL(`${name}.webp`, root);
const data = (name, width) => {
  // Build each standalone creative at up to 2× resolution; no network assets.
  const source = fileURLToPath(asset(name));
  const pixels = Math.ceil(width * 2);
  const args = name === 'watch'
    ? ['-resize', `${pixels}x>`, '-quality', '86']
    : ['-resize', `${pixels}x>`, '-define', 'webp:lossless=true'];
  return `data:image/webp;base64,${execFileSync('magick', [source, ...args, 'webp:-']).toString('base64')}`;
};

await mkdir(output, { recursive: true });
for (const design of sizes) {
  const { width, height } = design;
  const size = `${width}x${height}`;
  const panelX = height === 600 ? 0 : design.photo[2];
  const panelY = height === 600 ? design.photo[3] : 0;
  const colorBox = [panelX, panelY, width - panelX, height - panelY];
  const art = parts.map(name => {
    if (name === 'badge') return `<svg class="piece badge sale" viewBox="0 0 100 100" style="${box(design.badge)}" aria-hidden="true">${saleBadgeContents(66)}</svg>`;
    if (name in textCopy) {
      const fontSize = design[name][3] * textScale[name];
      const [, , textWidth, textHeight] = design[name];
      const border = name === 'cta' ? `<svg class="cta-border" viewBox="0 0 ${textWidth} ${textHeight}" aria-hidden="true">
        <rect class="cta-border-track" x="1" y="1" width="${textWidth - 2}" height="${textHeight - 2}" pathLength="100"/>
        <rect class="cta-border-trail" x="1" y="1" width="${textWidth - 2}" height="${textHeight - 2}" pathLength="100"/>
        <rect class="cta-border-highlight" x="1" y="1" width="${textWidth - 2}" height="${textHeight - 2}" pathLength="100"/>
      </svg>` : '';
      return `<span class="piece ${name} template-text" style="${box(design[name])};font-size:${fontSize}px"><b>${textCopy[name]}</b>${border}</span>`;
    }
    return `<img class="piece ${name}" alt="" style="${box(design[name])}" src="${data(name === 'brand' ? 'logo' : name, design[name][2])}">`;
  }).join('\n  ');
  await writeFile(new URL(`${size}.html`, output), `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="ad.size" content="width=${width},height=${height}">
<title>Gray &amp; Sons Black Friday | ${size}</title>
<style>
*{box-sizing:border-box}
html,body{margin:0;width:${width}px;height:${height}px;overflow:hidden}
.ad{display:block;position:relative;width:100%;height:100%;overflow:hidden;isolation:isolate;background:#fff;-webkit-tap-highlight-color:transparent}
.ad:focus-visible{outline:2px solid white;outline-offset:-3px}
.piece{display:block;position:absolute;pointer-events:none}
.photo{background:#fff}
.watch{z-index:1;object-fit:contain;object-position:center}
.badge{z-index:2}
.color-box{z-index:3;background:var(--color-box,#231f20)}
.headline,.savings,.category,.divider,.brand,.phone,.cta{z-index:4}
.divider,.cta{background:#ee242d}
.cta{display:grid;place-items:center}
.template-text{display:grid;place-items:center;text-align:center;white-space:nowrap;
  font-family:Arial,Helvetica,sans-serif;font-weight:900;line-height:1;color:#fff}
.headline.template-text{color:#ee242d;line-height:.94}
@keyframes reveal{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
@keyframes watch-in{from{transform:var(--watch-from)}to{transform:none}}
@keyframes badge-in{from{transform:var(--badge-from)}to{transform:none}}
@keyframes slide-box-in{from{transform:translateX(100%)}to{transform:none}}
.watch{
  --watch-from:translateX(var(--watch-enter, ${-design.watch[0] - design.watch[2]}px));
  --watch-to:translateX(var(--watch-exit, ${width - design.watch[0]}px));
}
.badge{--badge-from:translateY(var(--badge-travel, ${-design.badge[1] - design.badge[3]}px))}
.playing .color-box{animation:slide-box-in .5s cubic-bezier(.22,1,.36,1) both}
.playing .watch{animation:watch-in .65s ease-out both}
.playing .badge{animation:badge-in .4s .3s ease-out both}
.playing :is(.headline,.savings,.category,.divider,.brand,.phone,.cta){
  animation:reveal .28s var(--reveal-delay) ease-out both;
}
.playing[data-single-product] .badge polygon{
  transform-origin:50% 50%;
  transform-box:view-box;
  animation:star-spin 36s 1.1s linear infinite;
}
.cta-border{position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none;fill:none}
.cta-border-track{stroke:#fff4ce;stroke-width:1;opacity:.45}
.cta-border-trail,.cta-border-highlight{
  stroke-linecap:round;
  stroke-dashoffset:var(--sweep-start);
  filter:drop-shadow(0 0 2px #fff4ce);
  opacity:0;
}
.cta-border-trail{--sweep-start:0px;stroke:#ffdd78;stroke-width:1;stroke-dasharray:22 78}
.cta-border-highlight{--sweep-start:-15px;stroke:#fff;stroke-width:1.5;stroke-dasharray:7 93}
.playing :is(.cta-border-trail,.cta-border-highlight){
  animation:cta-border-sweep 1.9s 1.05s linear infinite;
}
@keyframes cta-border-sweep{
  from{opacity:1;stroke-dashoffset:var(--sweep-start)}
  to{opacity:1;stroke-dashoffset:calc(var(--sweep-start) - 100px)}
}
@keyframes star-spin{to{transform:rotate(360deg)}}
.headline{--reveal-delay:.45s}
.savings,.category,.divider{--reveal-delay:.55s}
.brand,.phone{--reveal-delay:.65s}
.cta{--reveal-delay:.75s}
.playing.playback-paused :is(.piece,.badge polygon),
.playing.playback-paused :is(.cta-border-trail,.cta-border-highlight){animation-play-state:paused}
@media (prefers-reduced-motion:reduce){
  .playing:not(.manual-replay) :is(.piece,.badge polygon),
  .playing:not(.manual-replay) :is(.cta-border-trail,.cta-border-highlight){animation:none}
}
</style>
</head>
<body>
<a class="ad" data-single-product href="${saleUrl}" target="_blank" rel="noopener"
   aria-label="Gray &amp; Sons Black Friday. Big savings on luxury watches and estate jewelry. 66% off new retail price on the featured Jacob &amp; Co. watch. Shop the sale. 305-615-2244.">
  <span class="piece color-box" style="${box(colorBox)}"></span>
  <span class="piece photo" style="${box(design.photo)}"></span>
  <span class="piece divider" style="${box(design.divider)}"></span>
  ${art}
</a>
<script>
var clickTag = window.clickTag || "${saleUrl}";
const ad = document.querySelector('.ad');
function syncClickTag() {
  try {
    const target = new URL(window.clickTag);
    if (['https:', 'http:'].includes(target.protocol)) ad.href = target.href;
  } catch {}
}
syncClickTag();
ad.addEventListener('click', syncClickTag);
${playbackScript}
if (!new URLSearchParams(location.search).has('still')) {
  ${initializePlayback}
}
</script>
</body>
</html>
`);
}
