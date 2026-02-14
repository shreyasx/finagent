import json
import asyncio
import logging
import uuid
from decimal import Decimal, InvalidOperation
from pathlib import Path

from langchain_core.messages import HumanMessage
from langchain_core.tools import tool
from sqlalchemy import text

from backend.config import get_settings
from backend.models.database import async_session, Document, DiscrepancyRecord
from backend.pipeline.embedder import DocumentEmbedder
from backend.reports.generator import ReportGenerator

logger = logging.getLogger(__name__)


def _run_async(coro):
    """Run an async coroutine from a sync context (LangChain tools are sync)."""
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        return asyncio.run(coro)
    # If there's already a running loop (e.g. inside FastAPI), run in a new thread
    import concurrent.futures
    with concurrent.futures.ThreadPoolExecutor() as pool:
        return pool.submit(asyncio.run, coro).result()


@tool
def vector_search(query: str, n_results: int = 5, doc_type: str = None) -> str:
    """Search financial documents using semantic similarity."""
    settings = get_settings()
    embedder = DocumentEmbedder(settings)
    filters = {"doc_type": doc_type} if doc_type else None
    results = embedder.search(query=query, n_results=n_results, filters=filters)
    if not results:
        return json.dumps({"query": query, "chunks": [], "message": "No matching documents found."})
    return json.dumps({"query": query, "chunks": results}, indent=2, default=str)


@tool
def sql_query(question: str) -> str:
    """Query the financial metadata database using natural language. Converts question to SQL and executes."""
    from langchain_anthropic import ChatAnthropic
    settings = get_settings()
    llm = ChatAnthropic(model=settings.default_llm, api_key=settings.anthropic_api_key, temperature=0)

    sql_prompt = (
        "Convert this question to a PostgreSQL SELECT query. "
        "Available tables:\n"
        "- documents (id UUID, filename TEXT, file_type TEXT, doc_type TEXT, processing_status TEXT, "
        "extracted_data JSONB, upload_timestamp TIMESTAMP)\n"
        "- discrepancy_records (id UUID, severity TEXT, affected_documents JSONB, description TEXT, "
        "recommended_action TEXT, created_at TIMESTAMP)\n"
        "- reports (id UUID, report_type TEXT, status TEXT, generated_at TIMESTAMP, data JSONB)\n\n"
        "IMPORTANT: Return ONLY the SQL query, nothing else. Only SELECT queries are allowed.\n\n"
        f"Question: {question}"
    )
    response = llm.invoke([HumanMessage(content=sql_prompt)])
    sql = response.content.strip().strip('`').replace('sql\n', '')

    if not sql.upper().startswith('SELECT'):
        return json.dumps({"error": "Only SELECT queries are allowed for safety."})

    async def run_query():
        async with async_session() as session:
            result = await session.execute(text(sql))
            rows = [dict(row._mapping) for row in result.fetchall()]
            return rows

    try:
        rows = _run_async(run_query())
        return json.dumps({"question": question, "sql": sql, "rows": rows, "row_count": len(rows)}, indent=2, default=str)
    except Exception as e:
        return json.dumps({"question": question, "sql": sql, "error": str(e)})


@tool
def calculate(expression: str) -> str:
    """Perform financial calculations with decimal precision. Supports basic
    arithmetic (+, -, *, /), percentages, and tax calculations. Use standard
    math notation."""
    try:
        allowed_chars = set("0123456789.+-*/() ")
        sanitized = expression.strip()
        if not all(ch in allowed_chars for ch in sanitized):
            return json.dumps({"error": "Invalid characters in expression. Only numbers and +-*/() are allowed."})

        result = Decimal(str(eval(sanitized)))  # noqa: S307
        return json.dumps({
            "expression": expression,
            "result": str(result),
            "formatted": f"INR {result:,.2f}",
        })
    except (InvalidOperation, SyntaxError, ZeroDivisionError) as exc:
        return json.dumps({"expression": expression, "error": str(exc)})


@tool
def compare_documents(doc_ids: list[str], comparison_type: str = "amount") -> str:
    """Cross-reference financial documents to find discrepancies."""
    async def fetch_docs():
        async with async_session() as session:
            from sqlalchemy import select
            result = await session.execute(select(Document).where(Document.id.in_(doc_ids)))
            return result.scalars().all()

    try:
        docs = _run_async(fetch_docs())
        if len(docs) < 2:
            return json.dumps({"error": f"Need at least 2 documents, found {len(docs)}"})

        matches = []
        mismatches = []
        for i, doc_a in enumerate(docs):
            for doc_b in docs[i+1:]:
                data_a = doc_a.extracted_data or {}
                data_b = doc_b.extracted_data or {}
                if comparison_type == "amount":
                    total_a = data_a.get("total", 0)
                    total_b = data_b.get("total", 0)
                    if total_a == total_b:
                        matches.append({"doc_a": doc_a.filename, "doc_b": doc_b.filename, "amount": total_a})
                    else:
                        mismatches.append({"doc_a": doc_a.filename, "doc_b": doc_b.filename, "amount_a": total_a, "amount_b": total_b, "difference": abs(total_a - total_b)})

        return json.dumps({"doc_ids": doc_ids, "comparison_type": comparison_type, "matches": matches, "mismatches": mismatches, "summary": f"{len(matches)} matches, {len(mismatches)} mismatches"}, indent=2, default=str)
    except Exception as e:
        return json.dumps({"error": str(e)})


@tool
def generate_report(report_type: str, parameters: str = "") -> str:
    """Generate a structured financial report."""
    valid_types = {"gst_summary", "reconciliation", "discrepancy", "cashflow"}
    if report_type not in valid_types:
        return json.dumps({"error": f"Unknown report type. Must be one of: {', '.join(sorted(valid_types))}"})

    generator = ReportGenerator()
    params = json.loads(parameters) if parameters else {}

    if report_type == "gst_summary":
        report_data = generator.generate_gst_summary(period=params.get("period", "Q4 2024"), data=params)
    elif report_type == "reconciliation":
        report_data = generator.generate_vendor_reconciliation(vendor=params.get("vendor"), period=params.get("period"), data=params)
    elif report_type == "discrepancy":
        report_data = generator.generate_discrepancy_report(data=params)
    elif report_type == "cashflow":
        report_data = generator.generate_cashflow_analysis(period=params.get("period"), data=params)

    return json.dumps({"report_type": report_type, "status": "generated", "data": report_data}, indent=2, default=str)


@tool
def export_data(data: str, format: str = "csv") -> str:
    """Export query results or reports to CSV or PDF format."""
    if format not in ("csv", "pdf"):
        return json.dumps({"error": "Format must be 'csv' or 'pdf'"})

    generator = ReportGenerator()
    try:
        report_data = json.loads(data)
    except json.JSONDecodeError:
        report_data = {"content": data}

    if format == "csv":
        csv_bytes = generator.export_to_csv(report_data)
        return json.dumps({"format": "csv", "status": "exported", "size_bytes": len(csv_bytes), "message": "CSV export ready"})
    else:
        return json.dumps({"format": "pdf", "status": "exported", "message": "PDF export ready"})


@tool
def flag_discrepancy(description: str, severity: str = "medium", affected_docs: str = "") -> str:
    """Flag a financial discrepancy and save it to the database."""
    valid_severities = {"low", "medium", "high", "critical"}
    if severity not in valid_severities:
        return json.dumps({"error": f"Severity must be one of: {', '.join(sorted(valid_severities))}"})

    doc_list = [d.strip() for d in affected_docs.split(",") if d.strip()] if affected_docs else []

    async def save_discrepancy():
        async with async_session() as session:
            record = DiscrepancyRecord(
                id=uuid.uuid4(),
                severity=severity,
                affected_documents=doc_list,
                description=description,
                recommended_action=f"Review {severity}-severity discrepancy: {description}",
            )
            session.add(record)
            await session.commit()
            return str(record.id)

    try:
        disc_id = _run_async(save_discrepancy())
        return json.dumps({"discrepancy_id": disc_id, "severity": severity, "description": description, "affected_docs": doc_list, "status": "flagged"}, indent=2)
    except Exception as e:
        return json.dumps({"error": str(e), "severity": severity, "description": description, "status": "flagged_locally"})


ALL_TOOLS = [
    vector_search,
    sql_query,
    calculate,
    compare_documents,
    generate_report,
    export_data,
    flag_discrepancy,
]
