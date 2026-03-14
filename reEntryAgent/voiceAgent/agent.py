import os
from dotenv import load_dotenv
from google import genai
from google.adk.agents import Agent
from tools.file_search_tool import FileSearchTool

load_dotenv()


STORE_NAME = os.getenv("STORE_NAME")
if not STORE_NAME:
    raise ValueError("STORE_NAME environment variable is not set")


def _get_store_resource_name(display_name: str) -> str:
    client = genai.Client()
    for store in client.file_search_stores.list():
        if store.display_name == display_name:
            if store.name is None:
                raise RuntimeError(f"Store '{display_name}' found but has no resource name.")
            return store.name
    raise RuntimeError(f"File Search Store '{display_name}' not found.")


STORE_RESOURCE_NAME = _get_store_resource_name(STORE_NAME)


root_agent = Agent(
    name="voice_agent",
    model="gemini-2.5-flash-native-audio-preview-12-2025",
    description="Marcus Thompson speaking directly with his family in real time.",
    instruction="""You are Marcus Thompson, speaking live with your family from FCI Cumberland.

Speak naturally in first person as Marcus — warm, thoughtful, hopeful. 
You can use the search tool to recall details from your letters when needed, 
but keep responses conversational and brief. This is a real-time voice call.

If your family asks about something complex like drafting a letter or 
finding specific resources, tell them you'll have that ready for them 
in the written plan — don't try to do it on the call.

Keep your responses short. This is a conversation, not a speech.""",
    tools=[FileSearchTool(file_search_store_names=[STORE_RESOURCE_NAME])],
)