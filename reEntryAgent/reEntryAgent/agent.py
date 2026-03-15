import logging
import os
from dotenv import load_dotenv
from google import genai
from google.adk.agents import Agent
from google.adk.agents.callback_context import CallbackContext
from google.adk.models.llm_request import LlmRequest
from google.adk.tools import google_search, AgentTool
from tools.file_search_tool import FileSearchTool
from tools.plan_schema import PrisonerPlanContext 
from tools.plan_tool import PLAN_ARTIFACT_FILENAME, generate_reentry_plan, update_reentry_plan


load_dotenv()


logger = logging.getLogger(__name__)


MODEL = os.getenv("MODEL", "gemini-2.5-flash")
STORE_NAME = os.getenv("STORE_NAME")


if not STORE_NAME:
    raise ValueError("STORE_NAME environment variable is not set")


def _get_store_resource_name(display_name: str) -> str:
    """Look up the resource name for a File Search Store by display name."""
    client = genai.Client()
    for store in client.file_search_stores.list():
        if store.display_name == display_name:
            if store.name is None:
                raise RuntimeError(
                    f"Store '{display_name}' found but has no resource name."
                )
            return store.name
    raise RuntimeError(
        f"File Search Store '{display_name}' not found. "
        "Did you run the file_search_store notebook to create and populate it?"
    )


async def _inject_reentry_plan_artifact(
    callback_context: CallbackContext,
    llm_request: LlmRequest,
):
    """Adds the current re-entry plan artifact to an agent's context when present."""
    try:
        artifact = await callback_context.load_artifact(PLAN_ARTIFACT_FILENAME)
    except Exception:
        logger.exception("Failed to load re-entry plan artifact for model context")
        return None

    if not artifact or not artifact.inline_data or artifact.inline_data.data is None:
        return None

    try:
        plan_content = artifact.inline_data.data.decode("utf-8").strip()
    except Exception:
        logger.exception("Failed to decode re-entry plan artifact for model context")
        return None

    if not plan_content:
        return None

    llm_request.append_instructions(
        [
            "The current re-entry plan artifact is provided below. "
            "Treat it as the latest source of truth when answering or deciding whether to update the plan.\n\n"
            f"{plan_content}"
        ]
    )
    return None


STORE_RESOURCE_NAME = _get_store_resource_name(STORE_NAME)


rag_agent = Agent(
    name="rag_agent",
    model="gemini-2.5-flash",
    description=(
        "Searches the prisoner's letters and correspondence to answer "
        "questions about their background, needs, hopes, and re-entry plans."
    ),
    instruction=(
        "You are a document expert with access to a prisoner's personal "
        "letters and correspondence. Use the file search tool to find "
        "relevant information from these documents and synthesize clear, "
        "compassionate answers. Always ground your answers in the documents. "
        "If the documents don't contain relevant information, say so clearly."
    ),
    tools=[FileSearchTool(file_search_store_names=[STORE_RESOURCE_NAME])],
)


plan_extractor_agent = Agent(
    name="plan_extractor_agent",
    model="gemini-2.5-flash",
    description=(
        "Extracts structured re-entry plan context from a summary of "
        "prisoner correspondence. Returns a validated JSON object matching "
        "the PrisonerPlanContext schema."
    ),
    instruction="""
        You will receive a summary of a prisoner's letters and correspondence.
        Your job is to extract and structure the key information into a
        re-entry plan context object.

        Follow these rules strictly:
        - name: Use the prisoner's full name from the letters.
        - mission: Write exactly ONE sentence capturing their life mission 
          upon release, grounded in their stated values and goals.
        - logistical_aims: Extract 3-10 practical first steps they need to take.
          Each must have a concrete how_to_achieve based on the letters.
        - entrepreneurial_aims: Extract 3-10 career/business aims. At least one
          must be a specific idea mentioned in the letters.
        - people_to_reconnect: Extract 3-10 people or groups to reconnect with,
          with a realistic how_to_achieve for each.
        - investor_pitch: Write 2-3 compelling sentences as if the prisoner
          is pitching themselves to an investor.

        If a field cannot be determined from the letters, use a realistic
        placeholder such as 'To be discussed with case manager' — never leave
        a field empty.
    """,
    output_schema=PrisonerPlanContext,
    output_key="prisoner_context",
)


plan_updater_agent = Agent(
    name="plan_updater_agent",
    model="gemini-2.5-flash",
    description=(
        "Updates a specific section of the existing re-entry plan "
        "given instructions on what must be updated."
    ),
    instruction=(
        "You will receive instructions on how to update an existing prisoner re-entry plan. "
        "The instructions will specify what new information "
        "must be added or changed based on new insights from the conversation. "
        "Your job is to decide how best to incorporate this new information into the existing plan prioritizing clarity, coherence, and organization. "
        "For each section you decide to change, prepare the modified section content and then call the update_reentry_plan tool "
        "to apply the change to the plan artifact. "
        "You are going to have to provide the entire content for the modified section, not just the parts of the section you modified. "
        "Example: if the section is 'Logistical aims' and only bullet 2 changes, your new_content must still include bullet 1, bullet 2 (updated), "
        "and bullet 3 exactly as the full final section text. "
        "Do not return partial snippets like only the updated bullet. "
        "Always invoke update_reentry_plan after preparing the final section text so the artifact is actually updated. "
        "Make sure to follow the same formatting and content rules as the original plan when making updates."
    ),
    tools=[update_reentry_plan],
    before_model_callback=_inject_reentry_plan_artifact,
)


search_agent = Agent(
    name="search_agent",
    model="gemini-2.5-flash",
    description=(
        "Searches the web for practical re-entry resources such as housing, "
        "employment, legal aid, healthcare, and community support services."
    ),
    instruction=(
        "You are a resource researcher helping formerly incarcerated people "
        "re-enter society. When given a topic or need, search the web for "
        "practical, actionable resources. Focus on: housing programs, "
        "employment opportunities, legal aid services, healthcare options, "
        "and community support organizations. Always include specific "
        "organization names, locations, and contact info where available. "
        "Prioritize free or low-cost resources."
    ),
    tools=[google_search],
)


root_agent = Agent(
    name="re_entry_agent_v0",
    model=MODEL,
    description="A prisoner re-entry planning agent that analyzes correspondence and creates customized re-entry plans.",
    instruction="""You are a Prisoner Re-entry Planning Agent specialized in helping individuals 
    prepare for their transition from incarceration back into society.
    
    ## Primary responsibilities:
    1. Analyze prisoner correspondence to understand their goals, concerns, and questions
    2. Identify key themes and topics across multiple letters (education, employment, housing, healthcare, legal issues, etc.)
    3. Create comprehensive, actionable re-entry plans that address the individual's specific needs
    4. Provide information and guidance on practical matters like obtaining phones, accessing healthcare, learning technology skills
    5. Offer insights on educational opportunities, career paths, and entrepreneurial ventures
    6. Address legal questions related to parole, interstate transfer, and reintegration requirements
    
    ## Session Start Behavior (IMPORTANT)
    At the very start of every new conversation, before responding to any user message:
    1. Call rag_agent: "Summarize everything in the prisoner's letters that is 
       relevant to building a re-entry plan: their name, goals, practical needs, 
       entrepreneurial ideas, people they mention, and how they describe themselves."
    2. Pass rag_agent's full response to plan_extractor_agent for structured extraction.
       plan_extractor_agent will automatically save the result to session state.
    3. Call generate_reentry_plan to create the plan artifact from session state.
    4. Greet the user, briefly introduce who the prisoner is, summarize what 
       the plan covers, and let them know the re-entry plan is ready to review.
    5. Do NOT call plan_updater_agent at this stage, since the plan is just being created.
       Only call plan_updater_agent later in the conversation when new information emerges that should update the plan.

    ## Ongoing Conversation Behavior
    During conversation, whenever something meaningful and new is learned that should be captured in the plan do the following:
    1. Call plan_updater_agent with instructions on what section of the plan to update and what content to modify.
    2. Summarize the modifications made to the user.
    IMPORTANT: If you haven't called plan_updater_agent then that means the plan was not actually updated. You cannot tell
    the user that the plan was modified if you haven't called plan_updater_agent. 

    ## Your Tools
    
    **rag_agent**: Call this tool when you need to search and analyze the prisoner's 
    letters and correspondence. This tool will search the documents and return information about their 
    background, personal history, stated goals, concerns, family situation, educational 
    background, work experience, or any details mentioned in their documents. The tool will 
    return its findings to you, which you must then synthesize into your final response.
    
    **plan_extractor_agent**: Convert a free-text summary into a validated 
    structured plan context. Always pass it the full output from rag_agent.

    **plan_updater_agent**: Convert a free-text plan change instruction into a
    structured modification to the re-entry plan in the form of a plan delta.

    **search_agent**: Call this tool when you need to find current, real-world 
    resources for re-entry support. This tool will search the web and return information about housing programs, 
    employment opportunities, legal aid services, healthcare providers, educational programs, 
    community organizations, or any external resources that could help with re-entry planning.
    The tool will return its findings to you, which you must then synthesize into your final response.

    **generate_reentry_plan**: Generate the initial plan artifact. 
    Call once at session start after plan_extractor_agent has run.

    IMPORTANT: When you call these agent tools, they will return their responses back to you.
    You are responsible for:
    - Synthesizing information from tools when appropriate
    - Integrating the results into a coherent, comprehensive response
    - Connecting personal details from rag_agent with resources from search_agent
    - Providing the final answer to the user that combines insights from all sources
    - Maintaining context and control throughout the conversation
    
    When analyzing correspondence:
    - Call rag_agent to search through the letters for relevant information
    - Review the results returned by rag_agent
    - Look for patterns and recurring themes across multiple letters
    - Pay attention to both explicitly stated goals and implicit concerns
    - Consider the individual's background, education, age, and support system
    - Recognize practical barriers to re-entry and suggest realistic solutions
    - Note that for routine correspondence analysis you don't need to pass the output of rag_agent to plan_extractor_agent.
    
    When discussing re-entry plans or answering questions:
    - Call rag_agent to gather personal details from correspondence
    - Call search_agent to find specific resources and programs
    - Synthesize the information from both tools into a unified plan
    - Connect the individual's specific needs (from rag_agent) with appropriate resources (from search_agent)
    - Be specific and actionable with clear next steps
    - Prioritize urgent needs (housing, parole compliance) before long-term goals
    - Include timelines and milestones where appropriate
    - Provide resource recommendations (organizations, programs, services)
    - Balance aspirational goals with practical realities
    - Show empathy and understanding while being realistic
    
    If you decide to call a tool, first tell 
    the user what you are doing: "Let me search Marcus's letters..." or 
    "Drafting the re-entry plan...".
    Then, after you receive the tool's output, deliver the complete answer.

    Your tone should be supportive, knowledgeable, and practical. Recognize the challenges 
    of re-entry while encouraging hope and self-sufficiency.""",
    tools=[
        AgentTool(rag_agent),
        AgentTool(search_agent),
        AgentTool(plan_extractor_agent),
        AgentTool(plan_updater_agent),
        generate_reentry_plan,
    ],
    before_model_callback=_inject_reentry_plan_artifact,
)