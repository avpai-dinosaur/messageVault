import uvicorn
from google.adk.cli.fast_api import get_fast_api_app
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles

app = get_fast_api_app(
    agents_dir=".",
    allow_origins=["http://127.0.0.1:8000"],
    web=False,
)

app.mount("/frontend", StaticFiles(directory="frontend"), name="frontend")

@app.get("/api/profile")
async def get_profile():
    return JSONResponse({
        "name": "Marcus Thompson",
        "facility": "FCI Cumberland"
    })

@app.get("/")
async def serve_frontend():
    return FileResponse("frontend/index.html")

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)