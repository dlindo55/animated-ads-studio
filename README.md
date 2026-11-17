# Animated Ads Studio

A local HTML5 marketing banner editor for Gray & Sons.

## Run locally

Requires Python 3 and ImageMagick (`magick` on PATH). Double-click **Open Banner Dashboard.command** on macOS, or run:

```sh
python3 source/server.py --open
```

Open http://127.0.0.1:8765/ in a browser. Code and template changes automatically reload the dashboard and preserve its working state. Python server changes require a restart.

## Create and save ads

Add Gray & Sons product URLs to import the main photo, gallery, brand and pricing from the product page JSON. Discount percentages follow the storefront's pricing rules. Change the creative text and colors, then generate the ads.

Campaigns are saved in browser IndexedDB. Use the same local address and browser profile to reopen them. Campaign data is local to that browser and is not stored in this repository.

The default sizes are 728×90, 300×600 and 300×250. Custom sizes scale the closest base layout. Size-specific controls are under **Edit layout**.

## Export

The download icon on each preview saves an individual Simpli.fi ZIP. **Download All** bundles those individual ZIPs. Extract that bundle and upload each size's ZIP separately.

Each upload ZIP contains a root `index.html`, local JPG product photos, a PNG logo, and one `{{clickMacro}}`. Configure the destination in Simpli.fi. Package limits are checked during export. Platform acceptance and live tracking require verification in Simpli.fi.

Single-product ads hold their layout, fade through up to three gallery images, rotate the star outline and animate the CTA border. Multiple products cycle with 1.5-second holds. The 728×90 Thanksgiving brand layout cycles brands and inserts a dynamic maximum retail-discount card.

## Base templates

Requires Node.js and ImageMagick:

```sh
node source/build.mjs
```

Templates live in `banners/`. The dashboard renders the current campaign from those templates and creates the final upload ZIPs in the browser.
