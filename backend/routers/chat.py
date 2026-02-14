import json
import uuid
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect
from jose import JWTError, jwt as jose_jwt
from langchain_core.messages import HumanMessage
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.agent.graph import create_agent_graph
from backend.config import get_settings
from backend.middleware.auth import get_current_user, interaction_guard, increment_interaction
from backend.models.database import User, get_db, async_session
from backend.models.schemas import ChatMessage, ChatRequest, ChatResponse

router = APIRouter(prefix="/chat", tags=["chat"])
logger = logging.getLogger(__name__)
settings = get_settings()


@router.post("/", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(interaction_guard),
):
    await increment_interaction(current_user, db)
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


async def authenticate_websocket(token: str) -> uuid.UUID | None:
    """Validate JWT from WebSocket query param and return user ID."""
    try:
        payload = jose_jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
        user_id = payload.get("sub")
        if user_id:
            return uuid.UUID(user_id)
    except (JWTError, ValueError):
        pass
    return None


@router.websocket("/ws")
async def chat_websocket(websocket: WebSocket, token: str = Query(default="")):
    if not token:
        await websocket.close(code=4001, reason="Missing token")
        return

    user_id = await authenticate_websocket(token)
    if not user_id:
        await websocket.close(code=4001, reason="Invalid token")
        return

    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            user_msg = message.get("content", "") or message.get("message", "")

            # Check interaction limit and increment
            async with async_session() as db:
                result = await db.execute(select(User).where(User.id == user_id))
                user = result.scalar_one_or_none()
                if not user or user.interaction_count >= user.max_interactions:
                    await websocket.send_json({
                        "type": "message",
                        "message": {
                            "id": str(uuid.uuid4()),
                            "role": "agent",
                            "content": f"You have used all {user.max_interactions if user else 50} interactions. No more requests allowed.",
                            "citations": [],
                            "timestamp": datetime.now(timezone.utc).isoformat(),
                        },
                    })
                    continue
                user.interaction_count += 1
                await db.commit()

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
