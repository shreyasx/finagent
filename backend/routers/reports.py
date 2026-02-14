import uuid
import logging

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.database import Report, get_db, async_session
from backend.models.schemas import ReportRequest, ReportResponse
from backend.reports.generator import ReportGenerator

router = APIRouter(prefix="/reports", tags=["reports"])
logger = logging.getLogger(__name__)


async def generate_report_task(report_id: str, report_type: str, parameters: dict):
    """Background task to generate a report."""
    generator = ReportGenerator()
    try:
        if report_type == "gst_summary":
            data = generator.generate_gst_summary(period=parameters.get("period", ""), data=parameters)
        elif report_type == "reconciliation":
            data = generator.generate_vendor_reconciliation(
                vendor=parameters.get("vendor"), period=parameters.get("period"), data=parameters
            )
        elif report_type == "discrepancy":
            data = generator.generate_discrepancy_report(data=parameters)
        elif report_type == "cashflow":
            data = generator.generate_cashflow_analysis(period=parameters.get("period"), data=parameters)
        else:
            data = {"error": f"Unknown report type: {report_type}"}

        async with async_session() as db:
            result = await db.execute(select(Report).where(Report.id == uuid.UUID(report_id)))
            report = result.scalar_one()
            report.data = data
            report.status = "completed"
            await db.commit()

        logger.info("Report %s generated successfully", report_id)
    except Exception as e:
        logger.error("Report generation failed for %s: %s", report_id, e)
        async with async_session() as db:
            result = await db.execute(select(Report).where(Report.id == uuid.UUID(report_id)))
            report = result.scalar_one_or_none()
            if report:
                report.status = "error"
                report.data = {"error": str(e)}
                await db.commit()


@router.post("/generate", response_model=ReportResponse, status_code=status.HTTP_201_CREATED)
async def generate_report(
    request: ReportRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    report_id = uuid.uuid4()
    report = Report(
        id=report_id,
        report_type=request.report_type,
        data={},
        status="generating",
    )
    db.add(report)
    await db.commit()
    await db.refresh(report)

    background_tasks.add_task(
        generate_report_task, str(report_id), request.report_type, request.parameters or {}
    )

    return ReportResponse.model_validate(report)


@router.get("/{report_id}", response_model=ReportResponse)
async def get_report(report_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Report).where(Report.id == report_id))
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")
    return ReportResponse.model_validate(report)


@router.get("/{report_id}/export")
async def export_report(
    report_id: uuid.UUID,
    format: str = "pdf",
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Report).where(Report.id == report_id))
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")
    if report.status != "completed":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Report is not yet completed")

    generator = ReportGenerator()
    report_type = report.report_type

    if format == "csv":
        csv_bytes = generator.export_to_csv(report.data)
        return Response(
            content=csv_bytes,
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={report_type}_{report_id}.csv"},
        )
    else:
        # Map report types to templates
        template_map = {
            "gst_summary": "gst_summary",
            "reconciliation": "reconciliation",
            "discrepancy": "discrepancy",
            "cashflow": "cashflow",
        }
        template = template_map.get(report_type, "gst_summary")
        try:
            pdf_bytes = generator.render_to_pdf(report.data, template)
            return Response(
                content=pdf_bytes,
                media_type="application/pdf",
                headers={"Content-Disposition": f"attachment; filename={report_type}_{report_id}.pdf"},
            )
        except Exception as e:
            logger.error("PDF rendering failed: %s", e)
            raise HTTPException(status_code=500, detail=f"PDF rendering failed: {str(e)}")
