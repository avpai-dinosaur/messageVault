import uvicorn
import asyncio

from google.adk.runners import InMemoryRunner
from google.adk.cli.utils.agent_loader import AgentLoader
from google.adk.cli.adk_web_server import AdkWebServer
from google.adk.evaluation.local_eval_sets_manager import LocalEvalSetsManager
from google.adk.evaluation.local_eval_set_results_manager import LocalEvalSetResultsManager
from google.adk.agents.run_config import RunConfig, StreamingMode
from google.adk.agents.live_request_queue import LiveRequestQueue
from google.genai import types

from fastapi import WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles

from reEntryAgent.agent import root_agent as reentry_root_agent
from voiceAgent.agent import root_agent as voice_root_agent


AGENT_DIR = "."
APP_NAME = "re_entry_agent"
ALLOWED_ORIGINS = ["http://localhost:8000", "http://127.0.0.1:8000"]


agent_loader = AgentLoader(agents_dir=AGENT_DIR)

eval_sets_manager = LocalEvalSetsManager(agents_dir=AGENT_DIR)
eval_set_results_manager = LocalEvalSetResultsManager(agents_dir=AGENT_DIR)

reentry_runner = InMemoryRunner(agent=reentry_root_agent, app_name=APP_NAME)
voice_runner = InMemoryRunner(agent=voice_root_agent, app_name=APP_NAME)

adk_webserver = AdkWebServer(
    agent_loader=agent_loader,
    session_service=reentry_runner.session_service,
    memory_service=reentry_runner.memory_service, # type: ignore
    artifact_service=reentry_runner.artifact_service, # type: ignore
    credential_service=reentry_runner.credential_service,
    eval_sets_manager=eval_sets_manager,
    eval_set_results_manager=eval_set_results_manager,
    agents_dir=AGENT_DIR,
)

app = adk_webserver.get_fast_api_app(
    allow_origins=ALLOWED_ORIGINS,
)
app.mount("/frontend", StaticFiles(directory="frontend"), name="frontend")


@app.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str) -> None:
    await websocket.accept()

    response_modalities = ["AUDIO"]
    voice_config = types.VoiceConfig(
        prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name='Charon')
    )
    run_config = RunConfig(
        streaming_mode=StreamingMode.BIDI,
        response_modalities=response_modalities,
        input_audio_transcription=types.AudioTranscriptionConfig(),
        output_audio_transcription=types.AudioTranscriptionConfig(),
        session_resumption=types.SessionResumptionConfig(),
        speech_config=types.SpeechConfig(voice_config=voice_config)
    )

    session = await voice_runner.session_service.create_session(
        app_name=APP_NAME,
        user_id=user_id,
    )
    
    live_request_queue = LiveRequestQueue()

    async def upstream_task() -> None:
        """Receive raw PCM audio from WebSocket and forward to the live model."""
        try:
            while True:
                message = await websocket.receive()
                if "bytes" in message:
                    audio_data = message["bytes"]
                    audio_blob = types.Blob(
                        mime_type="audio/pcm;rate=16000", data=audio_data
                    )
                    live_request_queue.send_realtime(audio_blob)
        except WebSocketDisconnect:
            live_request_queue.close()

    async def downstream_task() -> None:
        """Receive Events from run_live() and send to WebSocket."""
        async for event in voice_runner.run_live(
            user_id=user_id,
            session_id=session.id,
            live_request_queue=live_request_queue,
            run_config=run_config
        ):
            event_json = event.model_dump_json(exclude_none=True, by_alias=True)
            await websocket.send_text(event_json)

    try:
        await asyncio.gather(
            upstream_task(),
            downstream_task(),
            return_exceptions=True
        )
    finally:
        live_request_queue.close()


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