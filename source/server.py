"""Local launcher and same-origin importer for public Gray & Sons product cards."""
import argparse
import base64
import hashlib
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
import math
from pathlib import Path
import re
import subprocess
from urllib.parse import parse_qs, urljoin, urlsplit
from urllib.request import Request, urlopen
import webbrowser

ROOT = Path(__file__).resolve().parents[1]
SITE = "https://www.grayandsons.com"
SKU = re.compile(r"^/([a-z]\d{5,8})-[a-z0-9-]+/?$", re.I)


def fetch(url, limit=5_000_000):
    with urlopen(Request(url, headers={"User-Agent": "Mozilla/5.0"}), timeout=9) as response:
        data = response.read(limit + 1)
        if len(data) > limit:
            raise ValueError("The source file is too large.")
        return data


def number(value):
    try:
        return float(value) if value is not None else 0
    except (TypeError, ValueError):
        return math.nan


def discount_badge(item):
    # Mirrors GrayAndSons/src/helpers/product/discountBadge.js and its price helpers.
    quantity = item.get("qty")
    hold = number(item.get("on_hold"))
    if (quantity is not None and number(quantity) <= 0) or (hold != 0 and not math.isnan(hold)):
        return None, None
    if number(item.get("ask_for_price")) == 1:
        return None, None
    regular = number(item.get("price"))
    special = number(item.get("special_price"))
    is_on_sale = 0 < special < regular
    listed_price = item.get("price")
    price = special if is_on_sale else number(listed_price if listed_price is not None else item.get("final_price"))
    if not math.isfinite(price) or price <= 0:
        return None, None
    retail = number(item.get("retail_price"))
    has_retail = math.isfinite(retail) and retail > price
    if not has_retail and not is_on_sale:
        return None, None
    reference = retail if has_retail else regular
    if not math.isfinite(reference):
        return None, None
    percent = math.floor(100 * (1 - price / reference) + 0.5)
    if not 0 < percent <= 100:
        return None, None
    return percent, "retail" if has_retail else "sale"


def encode_product_image(photo):
    image_url = urljoin(SITE, photo)
    parsed = urlsplit(image_url)
    if parsed.scheme != "https" or not ((parsed.hostname or "").endswith(".grayandsons.com") or parsed.hostname == "grayandsons.com"):
        raise ValueError("The product image is outside Gray & Sons. Check the product URL.")
    original = fetch(image_url, limit=8_000_000)
    image = subprocess.run(
        ["magick", "-", "-auto-orient", "-strip", "-resize", "540x540>", "-quality", "86", "webp:-"],
        input=original, capture_output=True, check=True, timeout=12
    ).stdout
    return "data:image/webp;base64," + base64.b64encode(image).decode("ascii")


def import_product(raw_url):
    url = urlsplit(raw_url.strip())
    match = SKU.fullmatch(url.path)
    if url.scheme != "https" or url.netloc.lower() not in ("www.grayandsons.com", "grayandsons.com") or not match:
        raise ValueError("Enter a Gray & Sons product URL, including https://.")
    sku = match[1].lower()
    canonical = SITE + url.path.rstrip("/") + "/"
    data_url = SITE + "/page-data" + url.path.rstrip("/") + "/page-data.json"
    try:
        item = json.loads(fetch(data_url))["result"]["data"]["item"]
    except (KeyError, TypeError, ValueError) as exc:
        raise ValueError("This page did not return readable product data.") from exc
    if not isinstance(item, dict) or str(item.get("sku", "")).lower() != sku:
        raise ValueError("The product data did not match the SKU in the URL.")
    sale, reference = discount_badge(item)
    photo = next((entry["url"] for entry in (item.get("image"), item.get("small_image"), item.get("thumbnail"))
                  if isinstance(entry, dict) and entry.get("url")), None)
    if not photo:
        raise ValueError("No product image was found in the product data.")
    images = [encode_product_image(photo)]
    seen = {photo}
    for entry in item.get("media_gallery") or []:
        if not isinstance(entry, dict):
            continue
        url = entry.get("url")
        mime = (entry.get("gatsbyImageDataMock") or {}).get("mime") or ""
        if not isinstance(url, str) or not url or url in seen or mime.startswith("video/"):
            continue
        seen.add(url)
        try:
            images.append(encode_product_image(url))
        except (OSError, ValueError, subprocess.SubprocessError):
            continue
        if len(images) == 3:
            break
    return {"sku": sku.upper(), "name": item.get("title") or item.get("name") or sku.upper(),
            "url": canonical, "sale": sale, "reference": reference,
            "brand": item.get("brand") or item.get("manufacturer"),
            "image": images[0], "images": images}


def dashboard_revision():
    paths = [ROOT / "index.html"]
    paths.extend(path for path in (ROOT / "source").rglob("*")
                 if path.is_file() and path.suffix in {".js", ".mjs", ".css", ".py", ".webp"})
    paths.extend((ROOT / "banners").glob("*.html"))
    revision = hashlib.sha256()
    for path in sorted(paths):
        try:
            stamp = path.stat()
        except FileNotFoundError:
            continue
        revision.update(f"{path.relative_to(ROOT)}:{stamp.st_mtime_ns}:{stamp.st_size}\n".encode())
    return revision.hexdigest()


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self):
        path = urlsplit(self.path)
        if path.path == "/api/revision":
            content = json.dumps({"revision": dashboard_revision()}).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(content)))
            self.end_headers()
            self.wfile.write(content)
            return
        if path.path != "/api/product":
            return super().do_GET()
        try:
            payload = import_product(parse_qs(path.query).get("url", [""])[0])
            status = 200
        except ValueError as exc:
            payload, status = {"error": str(exc)}, 400
        except (OSError, subprocess.SubprocessError):
            payload, status = {"error": "Could not reach or read the Gray & Sons product data or image. Check the URL and try again."}, 502
        content = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--open", action="store_true")
    args = parser.parse_args()
    with ThreadingHTTPServer(("127.0.0.1", args.port), Handler) as server:
        address = f"http://127.0.0.1:{server.server_port}/"
        print(f"Banner dashboard: {address}", flush=True)
        if args.open:
            webbrowser.open(address)
        server.serve_forever()
