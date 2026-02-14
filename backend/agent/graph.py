from langgraph.graph import END, START, StateGraph

from backend.agent.nodes import (
    classify_query,
    execute_step,
    plan,
    retrieve,
    route_after_classify,
    route_after_execute,
    synthesize,
)
from backend.agent.state import AgentState


def create_agent_graph():
    """Build and compile the FinAgent LangGraph workflow.

    Flow:
        START -> classify -> (simple) -> retrieve -> synthesize -> END
                          -> (complex) -> plan -> execute_step(s) -> synthesize -> END
    """
    graph = StateGraph(AgentState)

    # Add nodes
    graph.add_node("classify", classify_query)
    graph.add_node("plan", plan)
    graph.add_node("retrieve", retrieve)
    graph.add_node("execute_step", execute_step)
    graph.add_node("synthesize", synthesize)

    # Add edges
    graph.add_edge(START, "classify")
    graph.add_conditional_edges(
        "classify",
        route_after_classify,
        {"retrieve": "retrieve", "plan": "plan"},
    )
    graph.add_edge("retrieve", "synthesize")
    graph.add_edge("plan", "execute_step")
    graph.add_conditional_edges(
        "execute_step",
        route_after_execute,
        {"execute_step": "execute_step", "synthesize": "synthesize"},
    )
    graph.add_edge("synthesize", END)

    return graph.compile()
