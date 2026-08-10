# USD/JPY Trader V4

Mobile-friendly research and paper-trading dashboard.

## What changed from V3

- Uses real USD/JPY 1-minute OHLC candles through Twelve Data.
- Removes random demo price/probabilities.
- Builds features from price history.
- Trains a small logistic-regression classifier in the browser.
- Uses a chronological 60% train / 20% validation / 20% test split.
- Fits feature scaling on the training set only.
- Chooses the signal threshold from validation data.
- Reports unseen test accuracy and majority-class baseline.
- Keeps all order actions paper-only.

## Important API-key note

This version stores the Twelve Data API key in browser localStorage. It is NOT committed to GitHub, but a browser-stored key should still be considered exposed to the person using that browser. For a public production app, use a server-side proxy/backend and keep the key in an environment variable.

Twelve Data documents `/time_series` for historical OHLC data, supports `1min`, and supports up to 5000 points per request subject to plan/credit limits.

## Setup

1. Get a Twelve Data API key from their website.
2. Open the app.
3. Paste the key into **Market data → API key**.
4. Tap **Save key**.
5. Select 1000 candles first.
6. Tap **Fetch & train**.
7. Wait for the model evaluation numbers.
8. Use paper trading only.

## Model warning

The model is an educational research baseline, not a profitable trading guarantee. One-minute FX is noisy, and live results can differ because of spread, slippage, latency, data-source differences and regime changes.

## GitHub Pages

The frontend files can be hosted on GitHub Pages. The app makes the data request from the browser, so network/CORS or provider-plan restrictions may prevent direct browser access. If that happens, the next upgrade should be a small server-side API proxy.


## V4.1 time display fix
The market-data timestamp from Twelve Data is UTC. V4.1 converts the candle timestamp to the phone/browser local timezone for display and also shows the original UTC source time. The candle timestamp is not the same thing as the current clock time; it identifies the market candle returned by the data provider.


## V4.2 automatic refresh

V4.2 automatically requests fresh 1-minute USD/JPY market data every 60 seconds while the page is open. It shows a countdown to the next refresh and reports whether the latest refresh succeeded.

The app remains paper-trading/research-only. The API key stays in browser local storage and is not committed to GitHub.

## V4.3 timestamp / next-candle fix

The displayed prediction time is no longer the timestamp of the previous completed candle. The model uses the latest completed 1-minute candle as input and labels the result for the **next 1-minute candle**.

For example, if the phone's current minute is **07:27**, the app labels the prediction target **07:28**. It also shows the latest completed candle separately so the data timestamp is not confused with the prediction target.

Automatic refresh is aligned to the start of each new minute (with a short delay for the new candle to become available) instead of simply running 60 seconds after the page was opened.
