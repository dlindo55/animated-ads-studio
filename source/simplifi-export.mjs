const encoder = new TextEncoder();

// A flat ZIP using the stored method. Image files are already compressed.
export function zipFiles(files) {
  const chunks = [];
  const directory = [];
  let offset = 0;
  let directorySize = 0;
  for (const [filename, bytes] of files) {
    const name = encoder.encode(filename);
    let crc = 0xffffffff;
    for (const byte of bytes) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(12, 33, true);
    local.setUint32(14, ~crc, true);
    local.setUint32(18, bytes.length, true);
    local.setUint32(22, bytes.length, true);
    local.setUint16(26, name.length, true);
    const entry = new DataView(new ArrayBuffer(46));
    entry.setUint32(0, 0x02014b50, true);
    entry.setUint16(4, 20, true);
    new Uint8Array(entry.buffer, 6, 26).set(new Uint8Array(local.buffer, 4, 26));
    entry.setUint32(42, offset, true);
    chunks.push(local.buffer, name, bytes);
    directory.push(entry.buffer, name);
    offset += 30 + name.length + bytes.length;
    directorySize += 46 + name.length;
  }
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, directorySize, true);
  end.setUint32(16, offset, true);
  return new Blob([...chunks, ...directory, end.buffer], {type: 'application/zip'});
}

async function convertImage(dataUrl, isLogo) {
  const bitmap = await createImageBitmap(await (await fetch(dataUrl)).blob());
  try {
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d', {alpha: isLogo});
    if (!isLogo) {
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    context.drawImage(bitmap, 0, 0);
    const type = isLogo ? 'image/png' : 'image/jpeg';
    const image = await new Promise(resolve => canvas.toBlob(resolve, type, .86));
    if (!image) throw new Error('Could not convert an image for the Simpli.fi ZIP.');
    return new Uint8Array(await image.arrayBuffer());
  } finally {
    bitmap.close();
  }
}

export async function makeSimplifiZip(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const ad = doc.querySelector('.ad');
  ad.removeAttribute('href');
  ad.tabIndex = 0;
  ad.setAttribute('role', 'link');
  const meta = doc.querySelector('meta[name="ad.size"]');
  const platformMeta = meta.cloneNode();
  platformMeta.name = 'ad size';
  platformMeta.content = meta.content.replace(',', ', ');
  doc.head.append(platformMeta);
  const script = doc.querySelector('script');
  const playback = script.textContent.slice(script.textContent.indexOf('function startPlayback()'));
  script.textContent = `
const ad = document.querySelector('.ad');
const clickTag = '{{clickMacro}}';
ad.addEventListener('click', () => window.open(clickTag, '_blank', 'noopener'));
ad.addEventListener('keydown', event => { if (event.key === 'Enter') ad.click(); });
${playback}`;
  const logoSource = ad.querySelector('img.brand')?.getAttribute('src');
  const files = [];
  const assetNames = new Map();
  let markup = '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;
  for (const match of markup.matchAll(/data:image\/(?:webp|png|jpeg);base64,[A-Za-z0-9+/=]+/g)) {
    const url = match[0];
    if (assetNames.has(url)) continue;
    const isLogo = url === logoSource;
    const name = isLogo ? 'logo.png' : `image-${files.length + 1}.jpg`;
    const bytes = await convertImage(url, isLogo);
    if (bytes.length > 4000000) throw new Error(`${name} exceeds Simpli.fi’s 4 MB file limit.`);
    assetNames.set(url, name);
    files.push([name, bytes]);
  }
  markup = markup.replace(/data:image\/(?:webp|png|jpeg);base64,[A-Za-z0-9+/=]+/g,
    url => assetNames.get(url));
  files.unshift(['index.html', encoder.encode(markup)]);
  if (files[0][1].length > 4000000 || files.reduce((sum, entry) => sum + entry[1].length, 0) > 4000000) {
    throw new Error('This banner exceeds the 4 MB rendered ad limit. Try using fewer products.');
  }
  const zip = zipFiles(files);
  if (zip.size > 10000000) throw new Error('This ZIP exceeds the 10 MB compressed ad limit.');
  return zip;
}
