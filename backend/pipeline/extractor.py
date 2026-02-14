"""Text extraction from financial documents (PDF, CSV, XLSX)."""

import logging
from pathlib import Path

import fitz  # PyMuPDF
import pandas as pd

logger = logging.getLogger(__name__)


class DocumentExtractor:
    """Extracts raw text from supported financial document formats."""

    SUPPORTED_TYPES = {"pdf", "csv", "xlsx"}
    MAX_SIZE_MB = 50

    def validate_file(self, file_path: Path, file_type: str) -> None:
        """Validate file type and size.

        Raises:
            ValueError: If file type is unsupported or file exceeds size limit.
            FileNotFoundError: If the file does not exist.
        """
        if file_type not in self.SUPPORTED_TYPES:
            raise ValueError(
                f"Unsupported file type: {file_type}. "
                f"Supported types: {', '.join(sorted(self.SUPPORTED_TYPES))}"
            )
        if not file_path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")
        file_size = file_path.stat().st_size
        max_bytes = self.MAX_SIZE_MB * 1024 * 1024
        if file_size > max_bytes:
            raise ValueError(
                f"File size ({file_size / (1024 * 1024):.1f} MB) exceeds "
                f"maximum allowed size ({self.MAX_SIZE_MB} MB)."
            )

    def extract_text(self, file_path: Path, file_type: str) -> str:
        """Extract text from a document based on its type.

        Args:
            file_path: Path to the document file.
            file_type: One of 'pdf', 'csv', 'xlsx'.

        Returns:
            Extracted text content as a string.
        """
        self.validate_file(file_path, file_type)
        logger.info("Extracting text from %s (type=%s)", file_path.name, file_type)

        if file_type == "pdf":
            return self.extract_pdf(file_path)
        elif file_type == "csv":
            return self.extract_csv(file_path)
        elif file_type == "xlsx":
            return self.extract_xlsx(file_path)
        else:
            raise ValueError(f"Unsupported file type: {file_type}")

    def extract_pdf(self, file_path: Path) -> str:
        """Extract text from PDF using PyMuPDF.

        Args:
            file_path: Path to the PDF file.

        Returns:
            Concatenated text from all pages with page markers.
        """
        pages: list[str] = []
        with fitz.open(file_path) as doc:
            for page_num, page in enumerate(doc, start=1):
                text = page.get_text()
                if text.strip():
                    pages.append(f"--- Page {page_num} ---\n{text}")
        result = "\n\n".join(pages)
        logger.info("Extracted %d pages from PDF %s", len(pages), file_path.name)
        return result

    def extract_csv(self, file_path: Path) -> str:
        """Extract text from CSV.

        Reads the raw CSV text to handle multi-section files (e.g. metadata
        header followed by a data table with different column counts).

        Args:
            file_path: Path to the CSV file.

        Returns:
            Raw CSV text content.
        """
        text = file_path.read_text(encoding="utf-8")
        line_count = len(text.strip().splitlines())
        logger.info("Extracted CSV %s: %d lines", file_path.name, line_count)
        return text

    def extract_xlsx(self, file_path: Path) -> str:
        """Extract text from XLSX using pandas with openpyxl engine.

        Args:
            file_path: Path to the XLSX file.

        Returns:
            String representation of all sheets concatenated.
        """
        sheets = pd.read_excel(file_path, engine="openpyxl", sheet_name=None)
        parts: list[str] = []
        for sheet_name, df in sheets.items():
            parts.append(f"--- Sheet: {sheet_name} ---\n{df.to_string(index=False)}")
        logger.info(
            "Extracted XLSX %s: %d sheet(s)", file_path.name, len(sheets),
        )
        return "\n\n".join(parts)
