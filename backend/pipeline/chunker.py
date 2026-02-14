"""Semantic chunking for RAG over financial documents."""

import logging
import re
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class Chunk:
    """A chunk of document text with associated metadata."""

    text: str
    metadata: dict = field(default_factory=dict)


class DocumentChunker:
    """Splits document text into overlapping chunks with metadata for RAG."""

    def __init__(self, chunk_size: int = 750, overlap: int = 100):
        """
        Args:
            chunk_size: Target chunk size in characters (approx tokens * 4).
            overlap: Number of overlapping characters between consecutive chunks.
        """
        self.chunk_size = chunk_size
        self.overlap = overlap

    def chunk_document(
        self, text: str, document_id: str, doc_type: str | None = None
    ) -> list[Chunk]:
        """Split document text into overlapping chunks with metadata.

        Args:
            text: Full document text (may include page markers like '--- Page X ---').
            document_id: Unique identifier for the source document.
            doc_type: Optional document type (invoice, bank_statement, gst_return).

        Returns:
            List of Chunk objects with text and metadata.
        """
        if not text.strip():
            return []

        # Build a page map: character offset -> page number
        page_map = self._build_page_map(text)

        chunks: list[Chunk] = []
        start = 0
        chunk_index = 0

        while start < len(text):
            end = start + self.chunk_size

            if end < len(text):
                end = self._find_break_point(text, end)

            chunk_text = text[start:end].strip()
            if chunk_text:
                page_number = self._get_page_number(page_map, start)
                chunk_type = self._detect_chunk_type(chunk_text)

                metadata = {
                    "document_id": document_id,
                    "chunk_index": chunk_index,
                    "chunk_type": chunk_type,
                    "page_number": page_number,
                }
                if doc_type:
                    metadata["doc_type"] = doc_type

                chunks.append(Chunk(text=chunk_text, metadata=metadata))
                chunk_index += 1

            # Advance with overlap
            next_start = end - self.overlap
            if next_start <= start:
                next_start = end
            start = next_start

        logger.info(
            "Chunked document %s into %d chunks (chunk_size=%d, overlap=%d)",
            document_id, len(chunks), self.chunk_size, self.overlap,
        )
        return chunks

    def _detect_chunk_type(self, text: str) -> str:
        """Heuristic detection of chunk content type.

        Args:
            text: The chunk text to classify.

        Returns:
            One of 'header', 'line_items', 'tax_summary', 'content'.
        """
        lower = text.lower()

        # Tax / summary indicators
        tax_keywords = {"total", "subtotal", "tax", "gst", "net liability", "grand total"}
        if sum(1 for kw in tax_keywords if kw in lower) >= 2:
            return "tax_summary"

        # Line-item / table indicators: multiple amounts on separate lines
        amount_pattern = re.compile(r"\d+[,.]?\d*\s*$", re.MULTILINE)
        if len(amount_pattern.findall(text)) >= 3:
            return "line_items"

        # Header indicators (beginning-of-document markers)
        header_keywords = {"invoice", "statement", "return", "date:", "period:", "gstin"}
        if sum(1 for kw in header_keywords if kw in lower) >= 2:
            return "header"

        return "content"

    def _find_break_point(self, text: str, target: int) -> int:
        """Find the best break point near the target position.

        Prefers paragraph breaks > sentence breaks > word breaks > exact position.

        Args:
            text: The full document text.
            target: The ideal character position to break at.

        Returns:
            The chosen break position.
        """
        # Search window: look back up to 150 chars from target
        window_start = max(0, target - 150)
        window = text[window_start:target]

        # Prefer paragraph break (double newline)
        para_idx = window.rfind("\n\n")
        if para_idx != -1:
            return window_start + para_idx + 2

        # Sentence break (period/question/exclamation followed by space or newline)
        sentence_match = None
        for match in re.finditer(r"[.!?]\s", window):
            sentence_match = match
        if sentence_match is not None:
            return window_start + sentence_match.end()

        # Word break (last space)
        space_idx = window.rfind(" ")
        if space_idx != -1:
            return window_start + space_idx + 1

        # Fallback to exact position
        return target

    def _build_page_map(self, text: str) -> list[tuple[int, int]]:
        """Build a mapping of character offsets to page numbers from page markers.

        Args:
            text: Document text containing '--- Page N ---' markers.

        Returns:
            Sorted list of (offset, page_number) tuples.
        """
        page_map: list[tuple[int, int]] = []
        for match in re.finditer(r"---\s*Page\s+(\d+)\s*---", text):
            page_map.append((match.start(), int(match.group(1))))
        return page_map

    def _get_page_number(self, page_map: list[tuple[int, int]], offset: int) -> int:
        """Determine the page number for a given character offset.

        Args:
            page_map: Sorted list from _build_page_map.
            offset: Character offset in the document text.

        Returns:
            Page number (1-based), defaults to 1 if no markers found.
        """
        page = 1
        for marker_offset, marker_page in page_map:
            if marker_offset <= offset:
                page = marker_page
            else:
                break
        return page
