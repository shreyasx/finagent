import csv
import io
from datetime import datetime
from pathlib import Path

from jinja2 import Environment, FileSystemLoader


class ReportGenerator:
    """Generates structured financial reports in multiple formats."""

    def __init__(self):
        template_dir = Path(__file__).parent / "templates"
        self.jinja_env = Environment(
            loader=FileSystemLoader(str(template_dir)),
            autoescape=True,
        )

    def generate_gst_summary(self, period: str, data: dict = None) -> dict:
        """Generate GST compliance summary report."""
        data = data or {}
        return {
            "report_type": "GST Summary",
            "generated_at": datetime.now().isoformat(),
            "period": period,
            "gstin": data.get("gstin", "N/A"),
            "output_tax": data.get("output_tax", 0.0),
            "input_tax": data.get("input_tax", 0.0),
            "net_liability": data.get("output_tax", 0.0) - data.get("input_tax", 0.0),
            "details": data.get("details", []),
            "total_taxable_value": data.get("total_taxable_value", 0.0),
            "cgst": data.get("cgst", 0.0),
            "sgst": data.get("sgst", 0.0),
            "igst": data.get("igst", 0.0),
        }

    def generate_vendor_reconciliation(
        self, vendor: str = None, period: str = None, data: dict = None
    ) -> dict:
        """Generate vendor payment reconciliation report.
        Cross-matches invoices against bank debits."""
        data = data or {}
        items = data.get("items", [])
        matched = [i for i in items if i.get("status") == "matched"]
        unmatched = [i for i in items if i.get("status") != "matched"]
        total_invoice = sum(i.get("invoice_amount", 0) for i in items)
        total_bank = sum(i.get("bank_debit", 0) for i in items)

        return {
            "report_type": "Vendor Reconciliation",
            "generated_at": datetime.now().isoformat(),
            "vendor": vendor or "All Vendors",
            "period": period or "All Time",
            "items": items,
            "matched_count": len(matched),
            "unmatched_count": len(unmatched),
            "total_invoice_amount": total_invoice,
            "total_bank_debit": total_bank,
            "total_variance": total_invoice - total_bank,
        }

    def generate_discrepancy_report(self, data: dict = None) -> dict:
        """Generate report of all flagged discrepancies."""
        data = data or {}
        items = data.get("items", [])
        by_severity = {}
        for item in items:
            sev = item.get("severity", "medium")
            by_severity[sev] = by_severity.get(sev, 0) + 1

        return {
            "report_type": "Discrepancy Report",
            "generated_at": datetime.now().isoformat(),
            "items": items,
            "total_count": len(items),
            "by_severity": by_severity,
        }

    def generate_cashflow_analysis(
        self, period: str = None, data: dict = None
    ) -> dict:
        """Generate cash flow analysis report."""
        data = data or {}
        total_income = data.get("total_income", 0.0)
        total_expenses = data.get("total_expenses", 0.0)

        return {
            "report_type": "Cash Flow Analysis",
            "generated_at": datetime.now().isoformat(),
            "period": period or "All Time",
            "total_income": total_income,
            "total_expenses": total_expenses,
            "net_cashflow": total_income - total_expenses,
            "monthly_breakdown": data.get("monthly_breakdown", []),
            "category_breakdown": data.get("category_breakdown", []),
        }

    def render_to_pdf(self, report_data: dict, template_name: str) -> bytes:
        """Render report data to PDF using WeasyPrint."""
        import weasyprint

        template = self.jinja_env.get_template(f"{template_name}.html")
        html = template.render(**report_data)
        return weasyprint.HTML(string=html).write_pdf()

    def export_to_csv(self, report_data: dict) -> bytes:
        """Export report data to CSV. Uses the 'items' key from report data
        as the rows, or flattens top-level keys if no items exist."""
        output = io.StringIO()
        items = report_data.get("items", [])

        if items:
            writer = csv.DictWriter(output, fieldnames=items[0].keys())
            writer.writeheader()
            writer.writerows(items)
        else:
            writer = csv.writer(output)
            for key, value in report_data.items():
                if not isinstance(value, (list, dict)):
                    writer.writerow([key, value])

        return output.getvalue().encode("utf-8")
