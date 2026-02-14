import json
import uuid
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from langchain_core.messages import HumanMessage

from backend.agent.graph import create_agent_graph
from backend.models.schemas import ChatMessage, ChatRequest, ChatResponse

router = APIRouter(prefix="/chat", tags=["chat"])
logger = logging.getLogger(__name__)


@router.post("/", response_model=ChatResponse)
async def chat(request: ChatRequest):
    conversation_id = request.conversation_id or str(uuid.uuid4())

    try:
        graph = create_agent_graph()
        initial_state = {
            "messages": [HumanMessage(content=request.message)],
            "query": request.message,
            "classification": None,
            "plan_steps": [],
            "current_step": 0,
            "tool_results": [],
            "final_answer": None,
            "citations": [],
            "thinking_steps": [],
        }
        result = graph.invoke(initial_state)

        response_message = ChatMessage(
            role="assistant",
            content=result.get("final_answer", "I could not generate a response."),
            citations=result.get("citations", []),
            thinking_steps=result.get("thinking_steps", []),
        )
    except Exception as e:
        logger.error("Agent error: %s", e)
        response_message = ChatMessage(
            role="assistant",
            content=f"I encountered an error while processing your request: {str(e)}",
        )

    return ChatResponse(message=response_message, conversation_id=conversation_id)


@router.websocket("/ws")
async def chat_websocket(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            user_msg = message.get("content", "") or message.get("message", "")

            try:
                graph = create_agent_graph()
                initial_state = {
                    "messages": [HumanMessage(content=user_msg)],
                    "query": user_msg,
                    "classification": None,
                    "plan_steps": [],
                    "current_step": 0,
                    "tool_results": [],
                    "final_answer": None,
                    "citations": [],
                    "thinking_steps": [],
                }

                # Stream thinking steps and capture final result
                final_answer = None
                citations = []

                async for event in graph.astream(initial_state):
                    for node_name, node_output in event.items():
                        steps = node_output.get("thinking_steps", [])
                        for step in steps:
                            await websocket.send_json({
                                "type": "thinking",
                                "content": step.get("description", "Processing..."),
                                "tool": step.get("step", node_name),
                            })
                        if node_output.get("final_answer"):
                            final_answer = node_output["final_answer"]
                        if "citations" in node_output:
                            citations = node_output["citations"]

                if not final_answer:
                    final_answer = "I could not generate a response."

                await websocket.send_json({
                    "type": "message",
                    "message": {
                        "id": str(uuid.uuid4()),
                        "role": "agent",
                        "content": final_answer,
                        "citations": citations,
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    },
                })

            except Exception as e:
                logger.error("Agent WebSocket error: %s", e)
                await websocket.send_json({
                    "type": "message",
                    "message": {
                        "id": str(uuid.uuid4()),
                        "role": "agent",
                        "content": f"Error: {str(e)}",
                        "citations": [],
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    },
                })

    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected")
