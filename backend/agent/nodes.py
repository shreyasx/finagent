import json

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage

from backend.agent.prompts import (
    CLASSIFICATION_PROMPT,
    PLANNING_PROMPT,
    SYNTHESIS_PROMPT,
    SYSTEM_PROMPT,
)
from backend.agent.state import AgentState
from backend.agent.tools import ALL_TOOLS
from backend.config import get_settings


def _get_llm():
    """Create and return the configured LLM instance."""
    settings = get_settings()
    from langchain_anthropic import ChatAnthropic

    return ChatAnthropic(
        model=settings.default_llm,
        api_key=settings.anthropic_api_key,
        temperature=0,
    )


def classify_query(state: AgentState) -> dict:
    """Classify query as simple or complex using LLM."""
    llm = _get_llm()
    prompt = CLASSIFICATION_PROMPT.format(query=state["query"])
    response = llm.invoke([
        SystemMessage(content=SYSTEM_PROMPT),
        HumanMessage(content=prompt),
    ])
    classification = response.content.strip().lower()
    if classification not in ("simple", "complex"):
        classification = "simple"

    thinking_step = {
        "step": "classify",
        "description": f"Classified query as '{classification}'",
        "detail": f"Query: {state['query']}",
    }
    return {
        "classification": classification,
        "thinking_steps": [thinking_step],
    }


def plan(state: AgentState) -> dict:
    """Break complex query into sub-tasks."""
    llm = _get_llm()
    prompt = PLANNING_PROMPT.format(query=state["query"])
    response = llm.invoke([
        SystemMessage(content=SYSTEM_PROMPT),
        HumanMessage(content=prompt),
    ])

    try:
        steps = json.loads(response.content)
        if not isinstance(steps, list):
            steps = [response.content.strip()]
    except json.JSONDecodeError:
        steps = [line.strip().lstrip("- ") for line in response.content.strip().split("\n") if line.strip()]

    thinking_step = {
        "step": "plan",
        "description": f"Created plan with {len(steps)} steps",
        "detail": steps,
    }
    return {
        "plan_steps": steps,
        "current_step": 0,
        "thinking_steps": [thinking_step],
    }


def retrieve(state: AgentState) -> dict:
    """Simple retrieval for factual queries using vector search."""
    tool = ALL_TOOLS[0]  # vector_search
    result = tool.invoke({"query": state["query"]})

    thinking_step = {
        "step": "retrieve",
        "description": "Performed vector search for direct answer",
        "detail": state["query"],
    }
    return {
        "tool_results": [{"tool": "vector_search", "result": result}],
        "thinking_steps": [thinking_step],
    }


def execute_step(state: AgentState) -> dict:
    """Execute the current step in the plan."""
    current_idx = state["current_step"]
    step_description = state["plan_steps"][current_idx]

    tool_map = {name: t for t in ALL_TOOLS for name in [t.name]}

    llm = _get_llm()
    tool_selection_prompt = (
        f"Given this sub-task: \"{step_description}\"\n"
        f"Available tools: {', '.join(tool_map.keys())}\n"
        "Respond with a JSON object: {{\"tool\": \"tool_name\", \"args\": {{...}}}}\n"
        "Use only valid tool names and appropriate arguments."
    )
    response = llm.invoke([
        SystemMessage(content=SYSTEM_PROMPT),
        HumanMessage(content=tool_selection_prompt),
    ])

    try:
        tool_call = json.loads(response.content)
        tool_name = tool_call.get("tool", "vector_search")
        tool_args = tool_call.get("args", {"query": step_description})
    except (json.JSONDecodeError, AttributeError):
        tool_name = "vector_search"
        tool_args = {"query": step_description}

    selected_tool = tool_map.get(tool_name, ALL_TOOLS[0])
    result = selected_tool.invoke(tool_args)

    thinking_step = {
        "step": f"execute_step_{current_idx}",
        "description": f"Step {current_idx + 1}: {step_description}",
        "detail": {"tool": tool_name, "args": tool_args},
    }
    return {
        "tool_results": [{"tool": tool_name, "step": step_description, "result": result}],
        "current_step": current_idx + 1,
        "thinking_steps": [thinking_step],
    }


def synthesize(state: AgentState) -> dict:
    """Combine all results into a cited answer."""
    llm = _get_llm()

    step_results_text = ""
    for i, tr in enumerate(state.get("tool_results", []), 1):
        step_desc = tr.get("step", tr.get("tool", f"Step {i}"))
        step_results_text += f"\n--- Step {i}: {step_desc} ---\n{tr['result']}\n"

    prompt = SYNTHESIS_PROMPT.format(
        query=state["query"],
        step_results=step_results_text,
    )
    response = llm.invoke([
        SystemMessage(content=SYSTEM_PROMPT),
        HumanMessage(content=prompt),
    ])

    thinking_step = {
        "step": "synthesize",
        "description": "Synthesized final answer from all tool results",
        "detail": f"Combined {len(state.get('tool_results', []))} results",
    }
    return {
        "final_answer": response.content,
        "messages": [AIMessage(content=response.content)],
        "thinking_steps": [thinking_step],
    }


# --- Router functions ---

def route_after_classify(state: AgentState) -> str:
    """Route to 'retrieve' for simple or 'plan' for complex."""
    return "retrieve" if state.get("classification") == "simple" else "plan"


def route_after_execute(state: AgentState) -> str:
    """Check if more steps remain in the plan."""
    if state["current_step"] >= len(state["plan_steps"]):
        return "synthesize"
    return "execute_step"
