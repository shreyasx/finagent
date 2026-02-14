"""Embedding generation and ChromaDB vector storage for financial documents.

Uses ChromaDB's built-in SentenceTransformer embedding function (all-MiniLM-L6-v2)
so no external API key is needed for embeddings. Embeddings are generated locally.
"""

import logging

import chromadb
from chromadb.utils.embedding_functions import SentenceTransformerEmbeddingFunction

from backend.pipeline.chunker import Chunk

logger = logging.getLogger(__name__)


class DocumentEmbedder:
    """Generates embeddings locally and stores/queries them in ChromaDB."""

    def __init__(self, settings):
        self.client = chromadb.HttpClient(
            host=settings.chroma_host,
            port=settings.chroma_port,
        )
        # Uses all-MiniLM-L6-v2 by default — runs locally, no API key needed
        self.embedding_fn = SentenceTransformerEmbeddingFunction(
            model_name="all-MiniLM-L6-v2"
        )
        self.collection = self.client.get_or_create_collection(
            name=settings.chroma_collection,
            metadata={"hnsw:space": "cosine"},
            embedding_function=self.embedding_fn,
        )

    def store_chunks(self, chunks: list[Chunk], document_id: str) -> None:
        """Embed chunks and store in ChromaDB with metadata.

        ChromaDB auto-generates embeddings using the collection's embedding
        function, so we only need to pass the raw text.
        """
        if not chunks:
            logger.warning("No chunks to store for document %s", document_id)
            return

        texts = [chunk.text for chunk in chunks]
        ids = [f"{document_id}_chunk_{i}" for i in range(len(chunks))]

        metadatas = []
        for chunk in chunks:
            meta = dict(chunk.metadata)
            meta["document_id"] = document_id
            # ChromaDB requires metadata values to be str, int, float, or bool
            metadatas.append({k: v for k, v in meta.items() if v is not None})

        self.collection.upsert(
            ids=ids,
            documents=texts,
            metadatas=metadatas,
        )
        logger.info(
            "Stored %d chunks for document %s in ChromaDB", len(chunks), document_id
        )

    def search(
        self,
        query: str,
        n_results: int = 5,
        filters: dict | None = None,
    ) -> list[dict]:
        """Semantic search over stored documents.

        Args:
            query: Natural language search query.
            n_results: Maximum number of results to return.
            filters: Optional ChromaDB metadata filters (where clause).

        Returns:
            List of dicts with keys: text, metadata, score.
        """
        query_params: dict = {
            "query_texts": [query],
            "n_results": n_results,
        }
        if filters:
            query_params["where"] = filters

        results = self.collection.query(**query_params)

        search_results: list[dict] = []
        if results and results["documents"]:
            documents = results["documents"][0]
            metadatas = (
                results["metadatas"][0]
                if results["metadatas"]
                else [{}] * len(documents)
            )
            distances = (
                results["distances"][0]
                if results["distances"]
                else [0.0] * len(documents)
            )

            for doc, meta, dist in zip(documents, metadatas, distances):
                search_results.append(
                    {
                        "text": doc,
                        "metadata": meta,
                        "score": round(1.0 - dist, 4),
                    }
                )

        logger.info(
            "Search returned %d results for query: %.50s...",
            len(search_results),
            query,
        )
        return search_results

    def delete_document(self, document_id: str) -> None:
        """Remove all chunks for a document from ChromaDB."""
        self.collection.delete(where={"document_id": document_id})
        logger.info("Deleted all chunks for document %s from ChromaDB", document_id)
