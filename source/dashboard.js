import { makeSimplifiZip, zipFiles } from './simplifi-export.mjs';
import { playbackScript, initializePlayback } from './banner-playback.mjs?v=viewport-playback';
import { saleBadgeContents } from './sale-badge.mjs';

const sizes = ['728x90', '300x600', '300x250'];
const form = document.querySelector('#fields');
const importer = document.querySelector('#import-form');
const status = document.querySelector('#status');
const errors = document.querySelector('#errors');
const products = document.querySelector('#products');
const urlFields = document.querySelector('#urls');
const removeProduct = document.querySelector('#remove-product');
const generate = document.querySelector('#generate');
const productPhoto = document.querySelector('#product-photo');
const field = name => form.elements.namedItem(name);
const parser = new DOMParser();
const imported = [];
let ready = false;
let frame;
const readData = blob => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = reject;
  reader.readAsDataURL(blob);
});

const editDialog = document.querySelector('#edit-dialog');
const editPrompt = document.querySelector('#edit-prompt');
const editStatus = document.querySelector('#edit-status');
const editDrafts = new Map();
const layoutDefaults = {display: 'photo', starSize: 100, align: 'original'};
const layoutBySize = {'728x90': {display: 'brand', starSize: 125, align: 'edge'}};
const productDisplay = document.querySelector('#edit-product-display');
const starSize = document.querySelector('#edit-star-size');
const starAlign = document.querySelector('#edit-star-align');
let editSize;

function openEditor(size) {
  editSize = size;
  document.querySelector('#edit-title').textContent = `Edit ${size.replace('x', ' × ')} banner`;
  editPrompt.value = editDrafts.get(size) || '';
  const layout = panels.find(panel => panel.size === size).layout;
  productDisplay.value = layout.display;
  starSize.value = layout.starSize;
  starAlign.value = layout.align;
  editStatus.textContent = '';
  editDialog.showModal();
  productDisplay.focus();
}

document.querySelector('#edit-form').addEventListener('submit', event => {
  if (event.submitter.value !== 'apply') return;
  const panel = panels.find(panel => panel.size === editSize);
  panel.layout = {display: productDisplay.value, starSize: starSize.valueAsNumber, align: starAlign.value};
  renderPanel(panel, values(), 'replay');
});

editPrompt.addEventListener('input', () => {
  editDrafts.set(editSize, editPrompt.value);
  editStatus.textContent = '';
});
document.querySelector('#copy-edit').addEventListener('click', async () => {
  const prompt = editPrompt.value.trim();
  if (!prompt) {
    editPrompt.focus();
    return;
  }
  const request = `In Banner Studio, edit the ${editSize.replace('x', ' × ')} HTML5 banner.

${prompt}`;
  try {
    await navigator.clipboard.writeText(request);
    editStatus.textContent = 'Copied. Paste the request into Codex.';
  } catch {
    editPrompt.value = request;
    editPrompt.select();
    editStatus.textContent = 'Press Command+C to copy the selected request.';
  }
});

const editSizeSelect = document.querySelector('#edit-size');
const downloadAllButton = document.querySelector('#download-all');
const downloadIcon = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M12 3v12m-5-5 5 5 5-5M4 16v4h16v-4"/>
</svg>`;

function downloadFile(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

function simplifiFilename(size) {
  return `gray-and-sons-${size}-simplifi.zip`;
}

function createPanel(size) {
  const [width, height] = size.split('x').map(Number);
  const card = document.createElement('section');
  card.className = 'card';
  card.innerHTML = `<div class="card-head"><h3>${width} × ${height}</h3>
    <button type="button" class="secondary export-zip" aria-label="Download ${width} × ${height} Simpli.fi ZIP" title="Download Simpli.fi ZIP">${downloadIcon}</button></div>
    <div class="canvas"><iframe title="${width} by ${height} banner" width="${width}" height="${height}" sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"></iframe></div>`;
  const panel = {size, width, height, layout: {...layoutDefaults, ...layoutBySize[size]}, card, preview: card.querySelector('iframe')};
  const zipButton = card.querySelector('.export-zip');
  zipButton.addEventListener('click', async () => {
    if (!ready) return;
    zipButton.disabled = true;
    try {
      const zip = await makeSimplifiZip(createAd(panel, values(), 'final'));
      downloadFile(zip, simplifiFilename(size));
    } catch (error) {
      window.alert(error.message);
    } finally {
      zipButton.disabled = false;
    }
  });
  document.querySelector('#previews').append(card);
  editSizeSelect.add(new Option(`${width} × ${height}`, size));
  return panel;
}

const panels = sizes.map(createPanel);
document.querySelector('#edit-layout').addEventListener('click', () => {
  if (ready) openEditor(editSizeSelect.value);
});
downloadAllButton.addEventListener('click', async () => {
  if (!ready) return;
  downloadAllButton.disabled = true;
  downloadAllButton.textContent = 'Preparing ZIPs…';
  try {
    const settings = values();
    const exports = panels.map(panel => ({
      filename: simplifiFilename(panel.size),
      html: createAd(panel, settings, 'final'),
    }));
    const files = [];
    for (const {filename, html} of exports) {
      const zip = await makeSimplifiZip(html);
      files.push([filename, new Uint8Array(await zip.arrayBuffer())]);
    }
    downloadFile(zipFiles(files), 'gray-and-sons-simplifi-all.zip');
  } catch (error) {
    window.alert(error.message);
  } finally {
    downloadAllButton.disabled = false;
    downloadAllButton.textContent = 'Download All';
  }
});
const sizeDialog = document.querySelector('#size-dialog');
const sizeForm = document.querySelector('#size-form');
const sizeStatus = document.querySelector('#size-status');
const newSizeButton = document.querySelector('#new-size');
newSizeButton.addEventListener('click', () => {
  sizeForm.reset();
  sizeStatus.textContent = '';
  sizeDialog.showModal();
});
document.querySelector('#cancel-size').addEventListener('click', () => sizeDialog.close());

function fitIntoSize(doc, panel) {
  const {width, height, base} = panel;
  const scale = Math.min(width / base.width, height / base.height);
  const stage = doc.createElement('div');
  stage.style.cssText = `position:absolute;width:${base.width}px;height:${base.height}px;
    left:${(width - base.width * scale) / 2}px;top:${(height - base.height * scale) / 2}px;
    transform-origin:top left;transform:scale(${scale})`;
  stage.append(item(doc, 'ad'));
  doc.body.prepend(stage);
  const css = doc.createElement('style');
  css.textContent = `html,body{width:${width}px;height:${height}px;background:white}`;
  doc.head.append(css);
  doc.querySelector('meta[name="ad.size"]').content = `width=${width},height=${height}`;
  doc.title = `Gray & Sons | ${panel.size}`;
}

sizeForm.addEventListener('submit', event => {
  event.preventDefault();
  const width = sizeForm.elements.namedItem('width').valueAsNumber;
  const height = sizeForm.elements.namedItem('height').valueAsNumber;
  if (![width, height].every(value => Number.isSafeInteger(value) && value > 0 && value <= 10000)) {
    sizeStatus.textContent = 'Enter whole pixels from 1 to 10,000.';
    return;
  }
  const size = `${width}x${height}`;
  const existing = panels.find(panel => panel.size === size);
  if (existing) {
    sizeDialog.close();
    existing.card.scrollIntoView({block:'nearest'});
    existing.card.querySelector('.export-zip').focus();
    return;
  }
  const ratio = width / height;
  const distance = panel => Math.abs(Math.log(ratio / (panel.width / panel.height)));
  const base = panels.slice(0, sizes.length).reduce((best, panel) =>
    distance(panel) < distance(best) ? panel : best);
  const panel = createPanel(size);
  panel.base = base;
  panel.template = base.template;
  panels.push(panel);
  sizeDialog.close();
  renderPanel(panel, values(), 'replay');
  panel.card.scrollIntoView({block:'nearest'});
});

const style = `
.copy{display:grid;place-items:center;text-align:center;line-height:1.02;font-weight:900;font-family:Arial,Helvetica,sans-serif;color:white}
.copy b{display:block;max-width:100%;overflow-wrap:anywhere}
.headline.copy{display:flex;flex-direction:column;justify-content:center;color:#ee242d;line-height:.94}
.headline.copy b{white-space:nowrap;overflow-wrap:normal}
.cta.copy{background:var(--cta-color);color:var(--cta-text-color)}
.watch.custom-image{mix-blend-mode:multiply}
.watch.product-brand{color:#231f20;text-transform:uppercase;letter-spacing:.02em}
.badge.custom-sale{overflow:visible}
.ad:not(.playing) .other-product{display:none}
@media (prefers-reduced-motion:reduce){
  .ad.playing:not(.manual-replay) .other-product{display:none}
}
`;
const croppedPhotos = new Map();

async function prepareProductPhotos(product) {
  const sources = product.images?.length ? product.images : [product.image];
  await Promise.all(sources.filter(Boolean).map(async source => {
    if (croppedPhotos.has(source)) return;
    try {
      const bitmap = await createImageBitmap(await (await fetch(source)).blob());
      try {
        const canvas = document.createElement('canvas');
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const context = canvas.getContext('2d', {willReadFrequently: true});
        context.drawImage(bitmap, 0, 0);
        const {width, height} = canvas;
        const {data} = context.getImageData(0, 0, width, height);
        let left = width, right = -1, top = height, bottom = -1;
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            if (data[i + 3] < 32 || Math.min(data[i], data[i + 1], data[i + 2]) >= 242) continue;
            left = Math.min(left, x);
            right = Math.max(right, x);
            top = Math.min(top, y);
            bottom = Math.max(bottom, y);
          }
        }
        if (right < left || bottom < top) return;
        const padding = Math.ceil(Math.max(right - left, bottom - top) * .02);
        left = Math.max(0, left - padding);
        top = Math.max(0, top - padding);
        right = Math.min(width - 1, right + padding);
        bottom = Math.min(height - 1, bottom + padding);
        canvas.width = right - left + 1;
        canvas.height = bottom - top + 1;
        context.drawImage(bitmap, left, top, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
        croppedPhotos.set(source, canvas.toDataURL('image/webp', .9));
      } finally {
        bitmap.close();
      }
    } catch {
      // Use the original photo if it cannot be cropped.
    }
  }));
}

function createPhotoLoop(doc, watch, images, css) {
  const gallery = doc.createElement('span');
  gallery.className = watch.className;
  gallery.style.cssText = watch.style.cssText;
  const slot = 2000;
  const fade = 450;
  const cycle = images.length * slot;
  const pct = time => 100 * time / cycle;
  css.textContent += `
@keyframes photo-fade {
  0%, 100% {opacity:0}
  ${pct(fade)}%, ${pct(slot)}% {opacity:1}
  ${pct(slot + fade)}% {opacity:0}
}
.photo-frame{position:absolute;inset:0;width:100%;height:100%;object-fit:contain}
.photo-frame:not(:first-child){opacity:0}
.playing .photo-frame{animation:photo-fade ${cycle}ms var(--photo-delay) linear infinite}
.playing.playback-paused .photo-frame{animation-play-state:paused}
@media (prefers-reduced-motion:reduce){
  .playing:not(.manual-replay) .photo-frame{animation:none}
}
`;
  images.forEach((src, index) => {
    const image = doc.createElement('img');
    image.src = src;
    image.alt = '';
    image.className = 'photo-frame';
    image.style.setProperty('--photo-delay', `${index * slot - fade}ms`);
    gallery.append(image);
  });
  watch.replaceWith(gallery);
  return gallery;
}

const widthOf = el => parseFloat(el.style.width);
const heightOf = el => parseFloat(el.style.height);
const canvas = document.createElement('canvas').getContext('2d');
function fit(text, initial, width) {
  let size = initial;
  while (size > 4) {
    canvas.font = `900 ${size}px Arial`;
    if (canvas.measureText(text).width <= width) break;
    size -= .25;
  }
  return size;
}

function replaceText(doc, el, text, initial, maxWidth = widthOf(el)) {
  const replacement = doc.createElement('span');
  replacement.className = el.className + ' copy';
  replacement.style.cssText = el.style.cssText;
  const content = doc.createElement('b');
  content.textContent = text;
  content.style.fontSize = `${fit(text, initial, maxWidth - 2)}px`;
  replacement.append(content);
  el.replaceWith(replacement);
  return content;
}

function drawSale(doc, el, product) {
  el.innerHTML = saleBadgeContents(product.sale);
}

const defaults = Object.fromEntries(
  Array.from(form.querySelectorAll('input[name]'), input => [input.name, input.defaultValue])
);
const values = () => Object.fromEntries(Object.keys(defaults).map(key => [key, field(key).value.trim()]));
const item = (doc, name) => doc.querySelector('.' + name);
function createAd(panel, v, playback) {
  const doc = parser.parseFromString(panel.template, 'text/html');
  const ad = item(doc, 'ad');
  const bgChanged = v['color-box'] !== defaults['color-box'];
  for (const css of ['color-box', 'cta-color', 'cta-text-color']) ad.style.setProperty('--' + css, v[css]);
  const css = doc.createElement('style');
  css.textContent = style;
  doc.head.append(css);

  const head = item(doc, 'headline');
  const title = replaceText(doc, head, v['title-1'], heightOf(head) * .53);
  title.className = 'title-1';
  title.style.color = v['title-1-color'];
  const line = title.cloneNode();
  line.className = 'title-2';
  line.style.color = v['title-2-color'];
  line.textContent = v['title-2'];
  line.style.fontSize = `${fit(v['title-2'], heightOf(head) * .53, widthOf(head) - 2)}px`;
  title.after(line);

  const savings = item(doc, 'savings');
  savings.classList.add('slogan');
  replaceText(doc, savings, v.slogan, heightOf(savings)).style.color = v['slogan-color'];
  const category = item(doc, 'category');
  const words = v.category.split(/\s+/);
  const split = Math.ceil(words.length / 2);
  const lines = words.length > 3 ? [words.slice(0, split).join(' '), words.slice(split).join(' ')] : [v.category];
  const categoryText = replaceText(doc, category, '', heightOf(category) * .48);
  const size = Math.min(...lines.map(line => fit(line, heightOf(category) * .48, widthOf(category) - 2)));
  categoryText.style.fontSize = `${size}px`;
  categoryText.style.color = v['category-color'];
  lines.forEach((line, index) => {
    if (index) categoryText.append(doc.createElement('br'));
    categoryText.append(line);
  });

  if (bgChanged) item(doc, 'brand').src = transparentBrand;
  const phone = item(doc, 'phone');
  replaceText(doc, phone, v.phone, heightOf(phone)).style.color = v['phone-color'];
  const cta = item(doc, 'cta');
  cta.classList.add('cta-button');
  const ctaBorder = cta.querySelector('.cta-border');
  const ctaLabel = replaceText(doc, cta, v['cta-button'], heightOf(cta) * .60);
  if (ctaBorder) ctaLabel.parentElement.append(ctaBorder);
  const watchTemplate = item(doc, 'watch');
  const badgeTemplate = item(doc, 'badge');
  const sequence = imported.length ? imported : [{sale: 66, reference: 'retail', brand: 'Jacob & Co.'}];
  const thanksgivingBrandAd = panel.size === '728x90' && panel.layout.display === 'brand'
    && v['title-1'].toUpperCase() === 'THANKSGIVING' && v['title-2'].toUpperCase() === 'SALE';
  const bestOffer = thanksgivingBrandAd ? imported.reduce((best, product) =>
    product.reference === 'retail' && product.sale > (best?.sale ?? 0) ? product : best, null) : null;
  const offerLines = bestOffer ? ['UP TO', `${bestOffer.sale}% OFF`, 'NEW RETAIL'] : null;
  const frames = [...sequence];
  if (offerLines) {
    const offerFrame = {offerLines, sale: null};
    frames.unshift(offerFrame);
    if (sequence.length > 1) {
      const middleSlot = Math.max(2, Math.ceil(sequence.length / 2));
      frames.splice(middleSlot, 0, offerFrame);
    }
  }
  const selected = sequence[Math.max(0, products.selectedIndex)];
  const entrance = 350;
  const hold = 1500;
  const exit = 350;
  const productDuration = entrance + hold + exit;
  if (frames.length > 1) {
    const cycle = frames.length * productDuration;
    const percent = ms => `${100 * ms / cycle}%`;
    css.textContent += `
@keyframes product-cycle {
  0% {transform:var(--product-from);animation-timing-function:ease-out}
  ${percent(entrance)} {transform:none}
  ${percent(entrance + hold)} {transform:none;animation-timing-function:ease-in}
  ${percent(productDuration)}, 100% {transform:var(--product-to)}
}
.watch{--product-from:var(--watch-from);--product-to:var(--watch-to)}
.badge{--product-from:var(--badge-from);--product-to:var(--badge-from)}
.playing :is(.watch,.badge){
  animation:product-cycle ${cycle}ms var(--product-start) linear infinite both;
}
.playing.playback-paused :is(.watch,.badge){animation-play-state:paused}
@media (prefers-reduced-motion:reduce){
  .playing:not(.manual-replay) :is(.watch,.badge){animation:none}
}
`;
  }
  const photo = item(doc, 'photo');
  const layout = panel.layout;
  const compactBanner = panel.size === '300x250';
  const starScale = layout.starSize / 100;
  const stickerWidth = widthOf(badgeTemplate) * starScale;
  const stickerHeight = heightOf(badgeTemplate) * starScale;
  const stickerLeft = layout.align === 'edge' ? 0 : parseFloat(badgeTemplate.style.left);
  frames.forEach((product, index) => {
    let watch = watchTemplate.cloneNode();
    const sticker = badgeTemplate.cloneNode();
    const start = `${index * productDuration}ms`;
    watch.classList.add('image');
    sticker.classList.add('sale');
    sticker.style.left = `${stickerLeft}px`;
    sticker.style.width = `${stickerWidth}px`;
    sticker.style.height = `${stickerHeight}px`;
    sticker.style.setProperty('--badge-travel', `${-parseFloat(sticker.style.top) - stickerHeight}px`);
    badgeTemplate.before(watch);
    if (layout.display === 'brand') {
      const shortBanner = heightOf(photo) <= 100;
      const left = shortBanner && product.sale !== null && !thanksgivingBrandAd ? stickerLeft + stickerWidth + 3 : 5;
      const available = widthOf(photo) - left - 5;
      const brand = product.brand || product.name || '';
      watch.style.left = `${left}px`;
      watch.style.width = `${available}px`;
      const label = replaceText(doc, watch, brand, shortBanner ? 19 : 32);
      watch = label.parentElement;
      watch.classList.add('product-brand');
      const brandWords = brand.trim().split(/\s+/);
      const brandLines = product.offerLines
        || (thanksgivingBrandAd && brandWords.length === 2 ? brandWords : [brand]);
      const maxSize = product.offerLines ? 25 : thanksgivingBrandAd ? 32 : shortBanner ? 19 : 32;
      const labelSize = Math.min(...brandLines.map(word => fit(word.toUpperCase(), maxSize, available - 4)));
      label.style.fontSize = `${labelSize}px`;
      if (brandLines.length > 1) {
        label.replaceChildren();
        brandLines.forEach((line, lineIndex) => {
          if (lineIndex) label.append(doc.createElement('br'));
          label.append(line);
        });
      }
      if (product.offerLines) {
        watch.classList.add('brand-offer-frame');
        label.style.color = 'var(--cta-color)';
        label.style.lineHeight = '1';
      }
      watch.style.setProperty('--watch-enter', `${-left - available}px`);
      watch.style.setProperty('--watch-exit', `${(panel.base || panel).width - left}px`);
    } else if (product.image) {
      watch.classList.add('custom-image');
      const photoSource = source => compactBanner ? croppedPhotos.get(source) || source : source;
      watch.src = photoSource(product.image);
      if (sequence.length === 1 && product.images?.length > 1) {
        watch = createPhotoLoop(doc, watch, product.images.slice(0, 3).map(photoSource), css);
      }
    }
    watch.style.setProperty('--product-start', start);
    sticker.style.setProperty('--product-start', start);
    if (product !== selected) {
      watch.classList.add('other-product');
      sticker.classList.add('other-product');
    }
    if (product.sale !== null && !thanksgivingBrandAd) {
      ad.append(sticker);
      drawSale(doc, sticker, product);
    }
  });
  watchTemplate.remove();
  badgeTemplate.remove();

  if (bestOffer) {
    const offer = `UP TO ${bestOffer.sale}% OFF NEW RETAIL`;
    const headline = doc.querySelector('.headline');
    headline.style.top = '9px';
    const savingsLine = doc.createElement('span');
    savingsLine.className = 'piece copy savings campaign-offer';
    savingsLine.style.cssText = 'left:162px;top:65px;width:148px;height:16px;z-index:4';
    savingsLine.style.fontSize = `${fit(offer, 13, 146)}px`;
    savingsLine.textContent = offer;

    ad.append(savingsLine);
  }
  ad.toggleAttribute('data-single-product', sequence.length === 1 && !thanksgivingBrandAd);
  const destination = ad.getAttribute('href');
  ad.setAttribute('aria-label', [v['title-1'], v['title-2'], v.slogan, v.category, ...sequence.map(product => [product.name, thanksgivingBrandAd ? '' : discountLabel(product)].filter(Boolean).join(', ')), bestOffer ? `Up to ${bestOffer.sale}% off new retail` : '', 'Gray & Sons', v.phone, v['cta-button']].filter(Boolean).join('. '));
  doc.querySelector('script').textContent = `
var clickTag = window.clickTag || ${JSON.stringify(destination).replaceAll('<','\\u003c')};
const ad = document.querySelector('.ad');
function syncClickTag() {
  try {
    const target = new URL(window.clickTag);
    if (['https:', 'http:'].includes(target.protocol)) ad.href = target.href;
  } catch {}
}
ad.addEventListener('click', syncClickTag);
syncClickTag();
${playback === 'replay' ? "ad.classList.add('manual-replay');" : ''}
${playback === 'still' ? '' : playbackScript + initializePlayback}
`;
  if (panel.base) fitIntoSize(doc, panel);
  return '<!doctype html>\n' + doc.documentElement.outerHTML;
}

function render(playback = 'still') {
  cancelAnimationFrame(frame);
  if (!ready) return;
  const v = values();
  for (const panel of panels) renderPanel(panel, v, playback);
}

function renderPanel(panel, v, playback) {
  panel.preview.srcdoc = createAd(panel, v, playback);
}

function schedule() {
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(() => render());
}

form.addEventListener('submit', event => event.preventDefault());
form.addEventListener('input', schedule);
form.addEventListener('reset', () => {
  imported.length = 0;
  updateProductList();
  schedule();
});

function discountLabel(product) {
  if (product.sale === null) return '';
  return `${product.sale}% off${product.reference === 'retail' ? ' new retail price' : ''}`;
}

function updateProductList(active = 0) {
  products.replaceChildren(...imported.map((product, index) =>
    new Option(`${index + 1}. ${product.sale === null ? "" : product.sale + "% off · "}${product.name}`, index)));
  const empty = imported.length === 0;
  if (empty) {
    productPhoto.hidden = true;
    productPhoto.removeAttribute('src');
    status.textContent = '';
  }
  products.hidden = document.querySelector('#product-label').hidden = removeProduct.hidden = empty;
  if (!empty) products.selectedIndex = active;
}

function select(product, playback = 'still') {
  productPhoto.src = product.image;
  productPhoto.alt = product.name;
  productPhoto.hidden = false;
  status.textContent = `${product.sku} · ${discountLabel(product) || 'No discount available'}`;
  render(playback);
}
products.addEventListener('change', () => select(imported[Number(products.value)]));
function addUrl(value = '') {
  const label = document.createElement('label');
  label.textContent = `Product URL ${urlFields.children.length + 1}`;
  const input = document.createElement('input');
  input.type = 'url';
  input.placeholder = 'https://www.grayandsons.com/…';
  input.value = value;
  label.append(input);
  urlFields.append(label);
  return input;
}
addUrl();
document.querySelector('#add-url').addEventListener('click', () => {
  const empty = [...urlFields.querySelectorAll('input')].find(input => !input.value.trim());
  (empty || addUrl()).focus();
});
removeProduct.addEventListener('click', () => {
  const index = products.selectedIndex;
  imported.splice(index, 1);
  updateProductList(Math.max(0, Math.min(index, imported.length - 1)));
  if (imported.length) {
    select(imported[products.selectedIndex]);
  } else {
    status.textContent = '';
    render();
  }
});
document.querySelector('#replay').addEventListener('click', () => render('replay'));
importer.addEventListener('submit', async event => {
  event.preventDefault();
  const generateAfterImport = event.submitter === generate;
  const inputs = [...urlFields.querySelectorAll('input')].filter(input => input.value.trim());
  if (!inputs.length) {
    if (generateAfterImport) render('replay');
    else urlFields.querySelector('input').focus();
    return;
  }
  const controls = [generate, ...importer.querySelectorAll('button,input,select')];
  controls.forEach(control => control.disabled = true);
  errors.replaceChildren();
  status.textContent = 'Adding products…';
  let last;
  try {
    for (const input of inputs) {
      const url = input.value.trim();
      try {
        const response = await fetch('/api/product?' + new URLSearchParams({url}));
        const product = await response.json();
        if (!response.ok) throw new Error(product.error);
        await prepareProductPhotos(product);
        let index = imported.findIndex(entry => entry.sku === product.sku);
        if (index === -1) {
          index = imported.length;
          imported.push(product);
        } else {
          imported[index] = product;
        }
        last = index;
        input.parentElement.remove();
      } catch (error) {
        const li = document.createElement('li');
        li.textContent = `${url} — ${error.message}`;
        errors.append(li);
      }
    }
    if (last !== undefined) {
      updateProductList(last);
      select(imported[last], generateAfterImport && !errors.children.length ? 'replay' : 'still');
    } else status.textContent = 'No products added.';
  } finally {
    controls.forEach(control => control.disabled = false);
    const next = [...urlFields.querySelectorAll('input')].find(input => !input.value.trim()) || addUrl();
    [...urlFields.children].forEach((label, index) => label.firstChild.textContent = `Product URL ${index + 1}`);
    next.focus();
  }
});

const reloadStateKey = 'banner-studio-reload-state';
const lastCampaignKey = 'banner-studio-last-campaign';
const campaignForm = document.querySelector('#campaign-form');
const campaignName = document.querySelector('#campaign-name');
const campaignList = document.querySelector('#campaign-list');
const campaignStatus = document.querySelector('#campaign-status');
const saveCampaignButton = campaignForm.querySelector('[type="submit"]');
const openCampaignButton = document.querySelector('#open-campaign');
let campaignId;

function snapshotCampaign() {
  return {
    fields: values(),
    panels: panels.map(({size, layout, base}) => ({size, layout, base: base?.size})),
    products: imported,
    selected: products.selectedIndex,
    urls: [...urlFields.querySelectorAll('input')].map(input => input.value),
    drafts: [...editDrafts],
    campaignId,
    campaignName: campaignName.value,
  };
}

async function restoreCampaign(state) {
  for (const [name, defaultValue] of Object.entries(defaults)) {
    field(name).value = state.fields[name] ?? defaultValue;
  }
  for (const panel of panels.splice(sizes.length)) {
    editSizeSelect.querySelector(`option[value="${panel.size}"]`)?.remove();
    panel.card.remove();
  }
  for (const panel of panels) panel.layout = {...layoutDefaults, ...layoutBySize[panel.size]};
  for (const entry of state.panels) {
    let panel = panels.find(candidate => candidate.size === entry.size);
    if (!panel) {
      const base = panels.find(candidate => candidate.size === entry.base);
      if (!base) continue;
      panel = createPanel(entry.size);
      panel.base = base;
      panel.template = base.template;
      panels.push(panel);
    }
    panel.layout = entry.layout;
  }
  await Promise.all(state.products.map(prepareProductPhotos));
  imported.splice(0, imported.length, ...state.products);
  updateProductList(Math.max(0, Math.min(state.selected, imported.length - 1)));
  errors.replaceChildren();
  if (imported.length) select(imported[products.selectedIndex]);

  urlFields.replaceChildren();
  for (const url of state.urls) addUrl(url);
  if (!urlFields.children.length) addUrl();
  editDrafts.clear();
  for (const [size, draft] of state.drafts) editDrafts.set(size, draft);
  campaignId = state.campaignId;
  campaignName.value = state.campaignName || campaignName.defaultValue;
}

const campaignDatabase = new Promise((resolve, reject) => {
  const request = indexedDB.open('banner-studio', 1);
  request.onupgradeneeded = () => request.result.createObjectStore('campaigns', {keyPath: 'id'});
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

async function campaignOperation(mode, run) {
  const db = await campaignDatabase;
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('campaigns', mode);
    const request = run(transaction.objectStore('campaigns'));
    transaction.oncomplete = () => resolve(request.result);
    transaction.onabort = () => reject(transaction.error);
  });
}

async function loadCampaignList() {
  const campaigns = await campaignOperation('readonly', store => store.getAll());
  campaigns.sort((a, b) => b.updated - a.updated);
  campaignList.replaceChildren(new Option('Choose a campaign', ''),
    ...campaigns.map(({name, id}) => new Option(name, id)));
  campaignList.value = campaignId || '';
  openCampaignButton.disabled = !campaignList.value;
}

async function saveCampaign() {
  const name = campaignName.value.trim();
  if (!name) throw new Error('Enter a campaign name.');
  const id = campaignId || crypto.randomUUID();
  await campaignOperation('readwrite', store => store.put({
    id, name, updated: Date.now(), state: {...snapshotCampaign(), campaignId: id, campaignName: name},
  }));
  campaignId = id;
  localStorage.setItem(lastCampaignKey, id);
  await loadCampaignList();
  campaignStatus.textContent = `Saved “${name}”.`;
}

campaignList.addEventListener('change', () => {
  openCampaignButton.disabled = !campaignList.value;
});
campaignForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (!ready || generate.disabled || saveCampaignButton.disabled) return;
  saveCampaignButton.disabled = true;
  try {
    await saveCampaign();
  } catch (error) {
    campaignStatus.textContent = error.message || 'Could not save the campaign.';
  } finally {
    saveCampaignButton.disabled = false;
  }
});
async function openCampaign(id) {
  const campaign = await campaignOperation('readonly', store => store.get(id));
  if (!campaign) return false;
  await restoreCampaign(campaign.state);
  localStorage.setItem(lastCampaignKey, id);
  campaignStatus.textContent = `Opened “${campaign.name}”.`;
  return true;
}

openCampaignButton.addEventListener('click', async () => {
  if (!ready || generate.disabled) return;
  try {
    if (!await openCampaign(campaignList.value)) throw new Error('Campaign could not be found.');
    render('auto');
  } catch (error) {
    campaignStatus.textContent = error.message || 'Could not open the campaign.';
  }
});

async function watchForCodeChanges() {
  let revision;
  async function poll() {
    try {
      const response = await fetch('/api/revision', {cache: 'no-store'});
      if (response.ok) {
        const next = (await response.json()).revision;
        if (revision && next !== revision) {
          if (ready && !generate.disabled && !editDialog.open && !sizeDialog.open) {
            try {
              sessionStorage.setItem(reloadStateKey, JSON.stringify(snapshotCampaign()));
            } catch {
              status.textContent = 'Update available. Save your exports before refreshing with ⌘R.';
              return;
            }
            location.reload();
            return;
          }
        } else {
          revision = next;
        }
      }
    } catch {
      // Try again if the local server is temporarily unavailable.
    }
    setTimeout(poll, 1500);
  }
  await poll();
}

void watchForCodeChanges();

let transparentBrand;
try {
  const get = async path => {
    const response = await fetch(path, {cache: 'no-store'});
    if (!response.ok) throw new Error(path);
    return response;
  };
  await Promise.all([
    get('source/assets/logo-clear.webp').then(response => response.blob()).then(readData)
      .then(data => { transparentBrand = data; }),
    ...panels.map(async panel => { panel.template = await (await get(`banners/${panel.size}.html`)).text(); }),
  ]);
  const saved = sessionStorage.getItem(reloadStateKey);
  try {
    if (saved) {
      const state = JSON.parse(saved);
      await restoreCampaign(state);
      // Capture the open tab when the campaign feature first arrives by auto reload.
      if (!Object.hasOwn(state, 'campaignName')) await saveCampaign();
      sessionStorage.removeItem(reloadStateKey);
    } else {
      const last = localStorage.getItem(lastCampaignKey);
      if (last) await openCampaign(last);
    }
    await loadCampaignList();
    saveCampaignButton.disabled = false;
  } catch {
    campaignStatus.textContent = 'Could not load campaign storage.';
  }
  ready = true;
  downloadAllButton.disabled = false;
  newSizeButton.disabled = false;
  render('auto');
} catch {
  status.textContent = 'Could not load the creative templates. Open the dashboard using the local launcher.';
}
