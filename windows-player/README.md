# KNK Signage Player for Windows

Dedicated Windows signage player with offline media caching.

## Installer
Open the repository's Actions tab, select Build KNK Windows Player, open the latest successful run, and download KNK-Signage-Player-Windows-Setup. Extract the ZIP and run the Setup EXE.

The installer is unsigned; Windows SmartScreen may warn about an unrecognized publisher.

## First use
Connect the mini PC to the internet and launch the player. Use the Cloudflare Access login window to sign in. The player stores media locally and checks for playlist changes every 2 minutes. Once fully downloaded, the last complete playlist plays without internet.

F11 toggles fullscreen; Ctrl+Shift+L opens login; Ctrl+R reloads; Esc leaves fullscreen. The app starts automatically when the Windows user logs in.

Photos use the configured display duration; videos play in full with audio; random shuffle separates videos with photos whenever photos are available.

Offline mode requires at least one successful media download while online. The installer is unsigned.
