# USD/JPY Trading App — Paper Trading MVP

A mobile-friendly Flutter frontend with a FastAPI/Python backend.

## Safety
This project is PAPER TRADING / ANALYSIS ONLY. It does not place broker orders.
The backend returns demo market data unless you connect your own market-data source.

## Structure

- `backend/` — FastAPI API, signal engine, risk calculator
- `mobile/` — Flutter Android app
- `data/` — optional CSV files
- `docs/` — architecture notes

## Run backend

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate
# Linux/macOS: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Open `http://127.0.0.1:8000/docs`.

## Run Flutter

Install Flutter and Android Studio/SDK first.

```bash
cd mobile
flutter pub get
flutter run
```

For a physical Android phone, set `API_BASE_URL` in
`mobile/lib/config.dart` to the computer's LAN IP, for example:

`http://192.168.1.10:8000`

The phone and computer must be on the same network.

## Next production steps

1. Replace demo candles with a licensed/live market-data provider.
2. Add historical data storage.
3. Train and validate the ML model with walk-forward testing.
4. Add authentication and HTTPS.
5. Add persistent paper-trade storage.
6. Add broker integration only after extensive paper testing.
