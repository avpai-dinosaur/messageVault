"""
plan_schema.py

Models defining the exact shape of the prisoner re-entry plan context.
"""

from pydantic import BaseModel, Field
from typing import List 


class BulletPoint(BaseModel):
    goal: str = Field(description="A short statement of the goal or aim.")
    how_to_achieve: str = Field(
        description=(
            "A brief explanation of how this goal can be achieved, "
            "grounded in what is known from the prisoner's letters "
            "and relevant Google Search results. "
            "If unknown, suggest a realistic first step."
        )
    )


class PrisonerPlanContext(BaseModel):
    """
    Structured re-entry plan context extracted from prisoner correspondence.
    All fields must be populated. Use placeholder text if information is
    not available in the letters.
    """

    name: str = Field(
        description="The prisoner's full name as found in the letters."
    )

    mission: str = Field(
        description=(
            "One sentence stating the prisoner's overall mission in life "
            "upon leaving prison. Should reflect their values, background, "
            "and stated goals from the letters."
        )
    )

    logistical_aims: List[BulletPoint] = Field(
        min_length=3,
        max_length=10,
        description=(
            "3-10 immediate practical aims upon leaving prison. "
            "Examples: obtaining a phone, finding housing, getting healthcare, "
            "learning technology, applying to programs."
        ),
    )

    entrepreneurial_aims: List[BulletPoint] = Field(
        min_length=3,
        max_length=10,
        description=(
            "3-10 entrepreneurial or career aims. At least one should describe "
            "a concrete business or creative idea mentioned in the letters. "
            "Others can be supporting steps toward that idea."
        ),
    )

    people_to_reconnect: List[BulletPoint] = Field(
        min_length=3,
        max_length=10,
        description=(
            "3-10 people or groups the prisoner wants to reconnect with. "
            "Should include names or relationships mentioned in the letters. "
            "The how_to_achieve field should describe how to re-establish contact."
        ),
    )

    investor_pitch: str = Field(
        description=(
            "2-3 sentences on how the prisoner would pitch themselves to an investor. "
            "Should highlight their unique background, skills, lived experience, "
            "and vision. Tone should be compelling and human."
        )
    )