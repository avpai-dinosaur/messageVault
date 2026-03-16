"""
plan_tool.py

Custom tools for creating and updating a re-entry plan artifact.
"""


import json
import re
from google.adk.tools import ToolContext
from google.genai import types
from pydantic import ValidationError
from .plan_schema import PrisonerPlanContext, BulletPoint 


PLAN_ARTIFACT_FILENAME = "reentry_plan.md"
MISSION_SECTION = "mission"
LOGISTICAL_SECTION = "logistical_aims"
ENTREPRENEURIAL_SECTION = "entrepreneurial_aims"
PEOPLE_SECTION = "people_to_reconnect"
INVESTOR_PITCH_SECTION = "investor_pitch"
SECTION_TITLES = {
    MISSION_SECTION: "Mission",
    LOGISTICAL_SECTION: "Immediate Logistical Aims",
    ENTREPRENEURIAL_SECTION: "Entrepreneurial Aims",
    PEOPLE_SECTION: "People to Reconnect With",
    INVESTOR_PITCH_SECTION: "Investor Pitch",
}
PLAN_SECTIONS = list(SECTION_TITLES)
DEFAULT_TBD = "_To be determined through conversation._"
DEFAULT_TBD_BULLET = f"- {DEFAULT_TBD}"
DEFAULTS_FROM_JSON = {
    "name": "Unknown",
    MISSION_SECTION: DEFAULT_TBD,
    LOGISTICAL_SECTION: DEFAULT_TBD_BULLET,
    ENTREPRENEURIAL_SECTION: DEFAULT_TBD_BULLET,
    PEOPLE_SECTION: DEFAULT_TBD_BULLET,
    INVESTOR_PITCH_SECTION: DEFAULT_TBD,
}
PLAN_TEMPLATE = """# Re-Entry Plan: {name}

## Mission
{mission}

## Immediate Logistical Aims
{logistical_aims}

## Entrepreneurial Aims
{entrepreneurial_aims}

## People to Reconnect With
{people_to_reconnect}

## Investor Pitch
{investor_pitch}
"""


async def generate_reentry_plan(tool_context: ToolContext) -> dict:
    """
    Generates a re-entry plan artifact from the prisoner's letters.

    This should be called once at the start of a new session if no plan exists yet.
    Structures prisoner_context found in the session state into formal re-entry
    plan markdown document saved as a session artifact.
    If a plan already exists, it simply returns the existing plan.

    Returns:
        A dict with 'status' and 'plan' (the markdown content) or 'error'.
    """
    try:
        existing = await tool_context.load_artifact(PLAN_ARTIFACT_FILENAME)
        if existing:
            return {
                "status": "already_exists",
                "plan": existing.inline_data.data.decode("utf-8"), # type: ignore
            }
    except Exception as e:
        pass
        
    prisoner_context = tool_context.state.get("prisoner_context", None)
    if not prisoner_context:
        return {
            "status": "error",
            "error": (
                "No prisoner context found in session state. "
                "Please call rag_agent and plan_extractor_agent to gather context from the letters "
                "before calling this tool."
            ),
        }

    try:
        normalized_context = _parse_prisoner_context(prisoner_context)
    except (TypeError, ValueError, ValidationError) as e:
        return {
            "status": "error",
            "error": (
                "Invalid prisoner_context format. Expected a PrisonerPlanContext-compatible "
                "dict, JSON string, or PrisonerPlanContext instance. "
                f"Details: {e}"
            ),
        }

    plan_content = _build_plan(normalized_context)

    await tool_context.save_artifact(
        filename=PLAN_ARTIFACT_FILENAME,
        artifact=types.Part.from_bytes(
            data=plan_content.encode("utf-8"),
            mime_type="text/markdown",
        ),
    )

    tool_context.state.update({"prisoner_context": None})

    return {
        "status": "created",
        "plan": plan_content,
    } 


async def update_reentry_plan(
    section: str,
    new_content: str,
    tool_context: ToolContext,
) -> dict:
    """
    Updates a specific section of the existing re-entry plan artifact.
    Call this when the conversation surfaces new information that should
    be captured in the plan.

    Args:
        section: Which section to update. Must be one of:
                 'mission', 'logistical_aims', 'entrepreneurial_aims',
                 'people_to_reconnect', 'investor_pitch'
        new_content: The new markdown content for that section.
                     For bullet-point sections, format each bullet as:
                     "- **Goal**: How to achieve it"

    Returns:
        A dict with 'status' and updated 'plan', or 'error'.
    """
    if section not in PLAN_SECTIONS:
        return {
            "status": "error",
            "error": f"Invalid section '{section}'. Must be one of: {PLAN_SECTIONS}",
        }

    try:
        existing = await tool_context.load_artifact(PLAN_ARTIFACT_FILENAME)
        if not existing:
            return {
                "status": "error",
                "error": "No plan artifact found. Call generate_reentry_plan first.",
            }
        current_plan = existing.inline_data.data.decode("utf-8") # type: ignore
    except Exception as e:
        return {
            "status": "error",
            "error": f"Could not load plan artifact: {e}",
        }

    heading = f"## {SECTION_TITLES[section]}"
    updated_plan = _replace_section(current_plan, heading, new_content)

    # Save updated artifact
    await tool_context.save_artifact(
        filename=PLAN_ARTIFACT_FILENAME,
        artifact=types.Part.from_bytes(
            data=updated_plan.encode("utf-8"),
            mime_type="text/markdown",
        ),
    )

    return {
        "status": "updated",
        "section": section,
        "plan": updated_plan,
    }


def _parse_prisoner_context(raw_context: object) -> PrisonerPlanContext:
    if isinstance(raw_context, PrisonerPlanContext):
        return raw_context

    if isinstance(raw_context, str):
        try:
            return PrisonerPlanContext.model_validate_json(raw_context)
        except ValidationError:
            # Fall back to explicit JSON parsing so malformed JSON can produce
            # a clearer error than schema validation alone.
            parsed = json.loads(raw_context)
            return PrisonerPlanContext.model_validate(parsed)

    if isinstance(raw_context, dict):
        return PrisonerPlanContext.model_validate(raw_context)

    raise TypeError(f"Unsupported prisoner_context type: {type(raw_context).__name__}")


def _format_bullets(bullets: list[BulletPoint]) -> str:
    return "\n".join(
        f"- **{bullet.goal}**: {bullet.how_to_achieve}" for bullet in bullets
    )


def _build_plan(context: PrisonerPlanContext) -> str:
    return PLAN_TEMPLATE.format(
        name=context.name,
        mission=context.mission,
        logistical_aims=_format_bullets(context.logistical_aims),
        entrepreneurial_aims=_format_bullets(context.entrepreneurial_aims),
        people_to_reconnect=_format_bullets(context.people_to_reconnect),
        investor_pitch=context.investor_pitch,
    )


def _replace_section(plan: str, heading: str, new_content: str) -> str:
    # Pattern: match heading line, then capture everything until next ## or end
    pattern = rf"({re.escape(heading)}\n)(.*?)(?=\n## |\Z)"
    replacement = rf"\g<1>{new_content.strip()}\n"
    updated = re.sub(pattern, replacement, plan, flags=re.DOTALL)

    # If heading wasn't found, append the section
    if updated == plan:
        updated = plan.rstrip() + f"\n\n{heading}\n{new_content.strip()}\n"

    return updated