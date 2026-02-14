from typing import TypedDict, Annotated, Literal

from langchain_core.messages import BaseMessage
from langgraph.graph.message import add_messages


class AgentState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]
    query: str
    classification: Literal["simple", "complex"] | None
    plan_steps: list[str]
    current_step: int
    tool_results: list[dict]
    final_answer: str | None
    citations: list[dict]
    thinking_steps: list[dict]
