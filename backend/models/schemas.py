import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


# --- Auth schemas ---


class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class AuthResponse(BaseModel):
    token: str
    email: str


class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    interaction_count: int
    max_interactions: int
    created_at: datetime

    model_config = {"from_attributes": True}


# --- Document extraction schemas ---


class LineItem(BaseModel):
    description: str
    quantity: float
    unit_price: float
    amount: float
    tax_rate: float | None = None


class InvoiceSchema(BaseModel):
    vendor_name: str
    invoice_number: str
    date: str
    due_date: str | None = None
    line_items: list[LineItem]
    subtotal: float
    tax_breakdown: dict
    total: float
    currency: str = "INR"


class BankStatementEntry(BaseModel):
    date: str
    description: str
    debit: float | None = None
    credit: float | None = None
    balance: float


class BankStatementSchema(BaseModel):
    bank_name: str
    account_number: str
    period_start: str
    period_end: str
    entries: list[BankStatementEntry]


class GSTReturnSchema(BaseModel):
    gstin: str
    period: str
    output_tax: float
    input_tax: float
    net_liability: float
    filing_status: str


# --- API request/response schemas ---


class DocumentResponse(BaseModel):
    id: uuid.UUID
    filename: str
    file_type: str
    doc_type: str | None
    processing_status: str
    upload_timestamp: datetime
    extracted_data: dict | None = None

    model_config = {"from_attributes": True}


class ChatMessage(BaseModel):
    role: str  # user / assistant
    content: str
    citations: list[dict] | None = None
    thinking_steps: list[dict] | None = None


class ChatRequest(BaseModel):
    message: str
    conversation_id: str | None = None


class ChatResponse(BaseModel):
    message: ChatMessage
    conversation_id: str


class ReportRequest(BaseModel):
    report_type: str
    parameters: dict | None = None


class ReportResponse(BaseModel):
    id: uuid.UUID
    report_type: str
    status: str
    generated_at: datetime
    download_url: str | None = None

    model_config = {"from_attributes": True}


class AnalyticsSummary(BaseModel):
    total_documents: int
    total_invoice_amount: float
    discrepancies_found: int
    reports_generated: int
    monthly_expenses: list[dict]
    vendor_distribution: list[dict]
