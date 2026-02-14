import uuid
import tempfile
import logging
from datetime import datetime
from pathlib import Path

import boto3
from botocore.config import Config as BotoConfig
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.config import get_settings
from backend.models.database import Document, get_db, async_session
from backend.models.schemas import DocumentResponse
from backend.pipeline.extractor import DocumentExtractor
from backend.pipeline.structured import StructuredExtractor
from backend.pipeline.chunker import DocumentChunker
from backend.pipeline.embedder import DocumentEmbedder

router = APIRouter(prefix="/documents", tags=["documents"])
settings = get_settings()
logger = logging.getLogger(__name__)


def get_s3_client():
    return boto3.client(
        "s3",
        endpoint_url=settings.s3_endpoint,
        aws_access_key_id=settings.s3_access_key,
        aws_secret_access_key=settings.s3_secret_key,
        config=BotoConfig(signature_version="s3v4"),
        region_name="us-east-1",
    )


async def process_document(doc_id: str, s3_key: str, filename: str, file_type: str):
    """Background task: download from S3, extract text, chunk, embed, store metadata."""
    try:
        async with async_session() as db:
            # Update status to processing
            result = await db.execute(select(Document).where(Document.id == uuid.UUID(doc_id)))
            doc = result.scalar_one()
            doc.processing_status = "processing"
            await db.commit()

        # Download from S3 to temp file
        s3 = get_s3_client()
        with tempfile.NamedTemporaryFile(suffix=f".{file_type}", delete=False) as tmp:
            s3.download_fileobj(settings.s3_bucket, s3_key, tmp)
            tmp_path = Path(tmp.name)

        try:
            # Step 1: Extract text
            extractor = DocumentExtractor()
            raw_text = extractor.extract_text(tmp_path, file_type)

            # Step 2: Detect document type and extract structured data
            structured = StructuredExtractor(settings)
            doc_type = structured.detect_document_type(raw_text)
            extracted_data = structured.extract(raw_text, doc_type)

            # Step 3: Chunk the text
            chunker = DocumentChunker()
            chunks = chunker.chunk_document(raw_text, doc_id, doc_type)

            # Step 4: Embed and store in ChromaDB
            embedder = DocumentEmbedder(settings)
            embedder.store_chunks(chunks, doc_id)

            # Step 5: Update database record
            async with async_session() as db:
                result = await db.execute(select(Document).where(Document.id == uuid.UUID(doc_id)))
                doc = result.scalar_one()
                doc.processing_status = "completed"
                doc.doc_type = doc_type
                doc.extracted_data = extracted_data
                await db.commit()

            logger.info("Document %s processed successfully", doc_id)
        finally:
            tmp_path.unlink(missing_ok=True)

    except Exception as e:
        logger.error("Failed to process document %s: %s", doc_id, e)
        async with async_session() as db:
            result = await db.execute(select(Document).where(Document.id == uuid.UUID(doc_id)))
            doc = result.scalar_one_or_none()
            if doc:
                doc.processing_status = "error"
                await db.commit()


@router.post("/upload", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    # Validate extension
    ext = file.filename.rsplit(".", 1)[-1].lower() if file.filename and "." in file.filename else ""
    if ext not in settings.allowed_extensions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File type '{ext}' not allowed. Allowed: {settings.allowed_extensions}",
        )

    # Validate size
    contents = await file.read()
    size_mb = len(contents) / (1024 * 1024)
    if size_mb > settings.max_file_size_mb:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File size {size_mb:.1f}MB exceeds limit of {settings.max_file_size_mb}MB",
        )

    # Upload to MinIO/S3
    doc_id = uuid.uuid4()
    s3_key = f"uploads/{doc_id}/{file.filename}"

    s3 = get_s3_client()
    try:
        # Ensure bucket exists
        try:
            s3.head_bucket(Bucket=settings.s3_bucket)
        except Exception:
            s3.create_bucket(Bucket=settings.s3_bucket)

        s3.put_object(Bucket=settings.s3_bucket, Key=s3_key, Body=contents)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload to storage: {str(e)}",
        )

    # Create DB record with processing status
    document = Document(
        id=doc_id,
        filename=file.filename,
        file_type=ext,
        s3_key=s3_key,
        upload_timestamp=datetime.utcnow(),
        processing_status="pending",
    )
    db.add(document)
    await db.commit()
    await db.refresh(document)

    # Kick off background processing
    background_tasks.add_task(process_document, str(doc_id), s3_key, file.filename, ext)

    return DocumentResponse.model_validate(document)


@router.get("/", response_model=list[DocumentResponse])
async def list_documents(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Document).order_by(Document.upload_timestamp.desc()))
    documents = result.scalars().all()
    return [DocumentResponse.model_validate(doc) for doc in documents]


@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(document_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Document).where(Document.id == document_id))
    document = result.scalar_one_or_none()
    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    return DocumentResponse.model_validate(document)
