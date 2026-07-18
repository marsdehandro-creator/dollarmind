# App icon & splash resources (DollarMind)

These source assets drive the native Android/iOS app icon and splash screen,
generated from the **DollarMind logo**.

## What's here
- `icon.svg` — square app icon (crown on deep-navy rounded square).
- `splash.svg` — splash background with the centered brand mark.

## Generating native assets

Capacitor's asset generator needs raster PNGs. Two options:

### Option A — use the official logo export (recommended)
Export the attached DollarMind logo as a **1024×1024 PNG** (crown centered on the
navy background) and save it as `dollarmind-assets/icon.png`, plus a **2732×2732**
`dollarmind-assets/splash.png`. Then:

```bash
cd frontend
npm install            # installs @capacitor/assets (dev dep)
npm run assets:generate
# (equivalent to: npx @capacitor/assets generate --assetPath dollarmind-assets \
#   --iconBackgroundColor '#0A0F2C' --splashBackgroundColor '#0A0F2C')
```

This writes icons/splashscreens into `android/` and `ios/`.

### Option B — rasterize the provided SVGs
If you don't have a PNG export, convert the SVGs here first (e.g. with
`rsvg-convert`, Inkscape, or an online converter) to
`dollarmind-assets/icon.png` / `dollarmind-assets/splash.png`, then run the same
`npm run assets:generate` command.

## Full mobile packaging flow

```bash
cd frontend
npm run build                      # Vite build -> dist/
npx cap add android                # once
npx cap sync android
npx cap open android               # opens Android Studio to build the APK
```

The web splash (src/components/brand/SplashScreen.tsx) matches the native splash
so the transition is seamless.
