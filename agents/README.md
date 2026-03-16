# Prisoner Voice Agent Local Development

## Prerequisites

- Python 3.11+ installed.
- Dependencies installed for this project:

```bash
cd agents
python3 -m pip install -r requirements.txt
```

## Environment Setup

1. Create a local env file from the example format.
2. The format and required variables are defined in `.env.example`.

```bash
cd agents
cp .env.example .env
```

Then edit `.env` and set real values for:
- `GOOGLE_API_KEY`
- `MODEL`
- `STORE_NAME`

## Important First-Time Step: Create File Search Store

Before running the app, run the notebook that creates and populates the File Search Store:

- `notebooks/file_search_store.ipynb`

This must be completed at least once so the store named by `STORE_NAME` exists.

## Run the App

Use this command from the repository root:

```bash
cd agents
python3 server.py
```

The app starts locally and serves the frontend/API from the same process.
