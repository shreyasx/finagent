"""LLM-powered structured data extraction from financial documents using Anthropic Claude."""

import logging

from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, SystemMessage

from backend.models.schemas import (
    BankStatementSchema,
    GSTReturnSchema,
    InvoiceSchema,
)

logger = logging.getLogger(__name__)

DOCUMENT_TYPES = {"invoice", "bank_statement", "gst_return"}

CLASSIFICATION_PROMPT = """You are a financial document classifier. Analyze the following document text and classify it as one of these types:
- invoice
- bank_statement
- gst_return

Respond with ONLY the document type, nothing else.

Document text:
{text}"""

EXTRACTION_PROMPTS = {
    "invoice": (
        "You are an expert financial data extraction system. "
        "Extract structured invoice data from the following document text with high accuracy. "
        "Pay careful attention to:\n"
        "- Vendor/supplier name and invoice number\n"
        "- Invoice date and due date (use ISO 8601 format YYYY-MM-DD)\n"
        "- Each line item: description, quantity, unit price, amount, and tax rate (if present)\n"
        "- Subtotal, tax breakdown (as a dict mapping tax type to amount), and total\n"
        "- Currency (default to INR if not specified)\n\n"
        "Be precise with all monetary amounts. Do not guess or fabricate values.\n\n"
        "Document text:\n{text}"
    ),
    "bank_statement": (
        "You are an expert financial data extraction system. "
        "Extract structured bank statement data from the following document text with high accuracy. "
        "Pay careful attention to:\n"
        "- Bank name and account number\n"
        "- Statement period start and end dates (use ISO 8601 format YYYY-MM-DD)\n"
        "- Each transaction entry: date, description, debit amount, credit amount, and running balance\n"
        "- Debit and credit should be null/None if not applicable to a given entry\n\n"
        "Be precise with all monetary amounts and dates. Do not guess or fabricate values.\n\n"
        "Document text:\n{text}"
    ),
    "gst_return": (
        "You are an expert financial data extraction system. "
        "Extract structured GST return data from the following document text with high accuracy. "
        "Pay careful attention to:\n"
        "- GSTIN (GST Identification Number)\n"
        "- Filing period\n"
        "- Output tax (tax collected on sales)\n"
        "- Input tax (tax paid on purchases)\n"
        "- Net tax liability (output_tax - input_tax)\n"
        "- Filing status\n\n"
        "Be precise with all tax amounts. Do not guess or fabricate values.\n\n"
        "Document text:\n{text}"
    ),
}

SCHEMA_MAP = {
    "invoice": InvoiceSchema,
    "bank_statement": BankStatementSchema,
    "gst_return": GSTReturnSchema,
}


class StructuredExtractor:
    """Uses Anthropic Claude to classify documents and extract structured financial data."""

    def __init__(self, settings):
        self.llm = ChatAnthropic(
            model=settings.default_llm,
            api_key=settings.anthropic_api_key,
            temperature=0,
            timeout=120,
            max_retries=2,
        )

    def detect_document_type(self, text: str) -> str:
        """Use Claude to classify document as invoice, bank_statement, or gst_return."""
        prompt = CLASSIFICATION_PROMPT.format(text=text[:3000])
        response = self.llm.invoke([HumanMessage(content=prompt)])
        doc_type = response.content.strip().lower()

        if doc_type not in DOCUMENT_TYPES:
            logger.warning(
                "LLM returned unknown document type '%s', defaulting to 'invoice'",
                doc_type,
            )
            doc_type = "invoice"

        logger.info("Detected document type: %s", doc_type)
        return doc_type

    def extract(self, text: str, doc_type: str) -> dict:
        """Extract structured data based on document type using Claude's structured output."""
        if doc_type not in SCHEMA_MAP:
            raise ValueError(
                f"Unknown document type: {doc_type}. "
                f"Must be one of: {', '.join(sorted(SCHEMA_MAP))}"
            )

        schema = SCHEMA_MAP[doc_type]
        prompt = EXTRACTION_PROMPTS[doc_type].format(text=text)

        structured_llm = self.llm.with_structured_output(schema)
        result = structured_llm.invoke([
            SystemMessage(content="Extract structured financial data accurately."),
            HumanMessage(content=prompt),
        ])

        logger.info("Extracted structured %s data", doc_type)
        return result.model_dump()
