# Krunch N' Krave Digital Signage

Target: **knksignage.vamtratech.com**. Separate from the KNK sales dashboard.

## Current status
This repository contains an early local-browser prototype. **It is not deployed and does not yet sync online or guarantee offline playback.** Do not expose it publicly without adding authentication and server-side storage.

## Run
Open `dashboard.html` in a browser for the management concept and `player.html` for a portrait preview. The two pages share localStorage when served from the same origin. For a simple local web server, run `python -m http.server 8765` in this directory, then visit http://localhost:8765/dashboard.html.

## Planned production architecture
- Cloudflare Pages + API + R2 object storage
- Authentication for management
- Local Windows player with downloaded media, validated manifests, atomic updates, watchdog and autostart
- Christmas reel approximately every 15 minutes, after a slide boundary
- Original product photos and official logo must remain unaltered

**Do not store real photos in localStorage for production.**
