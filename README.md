# USD/JPY Trading Web App

A mobile-friendly paper-trading dashboard that can be opened directly in Chrome.

## Run locally

Just open `index.html` in a browser.

## Publish free with GitHub Pages

1. Create a GitHub repository.
2. Upload `index.html`, `style.css`, `app.js`, and `README.md`.
3. Repository Settings -> Pages.
4. Under Build and deployment choose `Deploy from a branch`.
5. Select `main` and `/root`.
6. Save.
7. GitHub will provide the public Pages address.

## Current status

This is a front-end MVP. The signal engine is a DEMO placeholder and does not predict real market direction.

## Next upgrade

Connect the UI to the FastAPI backend and replace the demo signal with the validated ML model. Use a proper licensed market-data provider for live data. Keep paper trading enabled until extensive walk-forward and live-paper testing is complete.

Do not put API keys, broker passwords, or secret tokens in this repository.
