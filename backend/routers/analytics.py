import logging

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.middleware.auth import get_current_user
from backend.models.database import Document, DiscrepancyRecord, Report, User, get_db
from backend.models.schemas import AnalyticsSummary

router = APIRouter(prefix="/analytics", tags=["analytics"])
logger = logging.getLogger(__name__)


@router.get("/summary", response_model=AnalyticsSummary)
async def get_analytics_summary(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Count documents
    doc_count = (await db.execute(select(func.count(Document.id)))).scalar() or 0

    # Count discrepancies
    disc_count = (await db.execute(select(func.count(DiscrepancyRecord.id)))).scalar() or 0

    # Count reports
    report_count = (await db.execute(select(func.count(Report.id)))).scalar() or 0

    # Calculate total invoice amount from extracted_data
    docs_result = await db.execute(
        select(Document).where(Document.doc_type == "invoice", Document.extracted_data.isnot(None))
    )
    invoices = docs_result.scalars().all()
    total_amount = sum(
        (doc.extracted_data or {}).get("total", 0) for doc in invoices
    )

    # Build monthly expenses from bank statement entries
    monthly_expenses = []
    bank_docs = await db.execute(
        select(Document).where(Document.doc_type == "bank_statement", Document.extracted_data.isnot(None))
    )
    for doc in bank_docs.scalars().all():
        entries = (doc.extracted_data or {}).get("entries", [])
        month_totals = {}
        for entry in entries:
            if entry.get("debit"):
                month = entry.get("date", "")[:7]  # YYYY-MM
                month_totals[month] = month_totals.get(month, 0) + entry["debit"]
        for month, amount in sorted(month_totals.items()):
            monthly_expenses.append({"month": month, "amount": amount})

    # Build vendor distribution from invoices
    vendor_dist = {}
    for doc in invoices:
        data = doc.extracted_data or {}
        vendor = data.get("vendor_name", "Unknown")
        amount = data.get("total", 0)
        if vendor in vendor_dist:
            vendor_dist[vendor]["amount"] += amount
            vendor_dist[vendor]["count"] += 1
        else:
            vendor_dist[vendor] = {"vendor": vendor, "amount": amount, "count": 1}

    return AnalyticsSummary(
        total_documents=doc_count,
        total_invoice_amount=total_amount,
        discrepancies_found=disc_count,
        reports_generated=report_count,
        monthly_expenses=monthly_expenses,
        vendor_distribution=list(vendor_dist.values()),
    )
