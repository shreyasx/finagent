"use client";

import { useState, useEffect } from "react";
import { Upload as UploadIcon, FileText, FileSpreadsheet, CheckCircle, Clock, AlertCircle } from "lucide-react";
import FileUploader from "@/components/FileUploader";
import { useAuth } from "@/components/AuthProvider";
import { uploadDocument, getDocuments } from "@/lib/api";

interface UploadedDoc {
  id: string;
  filename: string;
  file_type: string;
  processing_status: string;
  upload_timestamp: string;
  extracted_data?: Record<string, unknown>;
}

function getFileIcon(fileType: string) {
  switch (fileType) {
    case "pdf":
      return <FileText className="h-5 w-5 text-neutral-700" />;
    case "csv":
    case "xlsx":
      return <FileSpreadsheet className="h-5 w-5 text-neutral-500" />;
    default:
      return <FileText className="h-5 w-5 text-neutral-400" />;
  }
}

function getStatusBadge(status: string) {
  switch (status) {
    case "completed":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-700">
          <CheckCircle className="h-3 w-3" />
          Completed
        </span>
      );
    case "processing":
    case "pending":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-500">
          <Clock className="h-3 w-3 animate-spin" />
          Processing
        </span>
      );
    case "error":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-500">
          <AlertCircle className="h-3 w-3" />
          Error
        </span>
      );
    default:
      return null;
  }
}

export default function UploadPage() {
  const { user, refreshUser } = useAuth();
  const [documents, setDocuments] = useState<UploadedDoc[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<UploadedDoc | null>(null);
  const [loadingDocs, setLoadingDocs] = useState(true);

  const isOverLimit = user
    ? user.interaction_count >= user.max_interactions
    : false;

  // Fetch user's documents on mount
  useEffect(() => {
    getDocuments()
      .then((docs) => {
        setDocuments(
          docs.map((d) => ({
            id: d.id,
            filename: d.filename,
            file_type: d.file_type,
            processing_status: d.processing_status,
            upload_timestamp: d.upload_timestamp,
            extracted_data: d.extracted_data,
          }))
        );
      })
      .catch(() => {
        // API not available
      })
      .finally(() => setLoadingDocs(false));
  }, []);

  const handleUpload = async (
    file: File,
    onProgress: (progress: number) => void
  ) => {
    try {
      const result = await uploadDocument(file, onProgress);

      const newDoc: UploadedDoc = {
        id: result.document_id,
        filename: file.name,
        file_type: file.name.split(".").pop() || "unknown",
        processing_status: "processing",
        upload_timestamp: new Date().toISOString(),
      };

      setDocuments((prev) => [newDoc, ...prev]);
      refreshUser();
    } catch (err) {
      throw err;
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      {/* Page header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-100">
            <UploadIcon className="h-5 w-5 text-neutral-700" />
          </div>
          <h1 className="text-xl font-bold text-neutral-900">Upload Documents</h1>
        </div>
        <p className="text-sm text-neutral-500 ml-[52px]">
          Upload financial documents for AI-powered analysis. Supported: PDF, CSV, XLSX.
        </p>
      </div>

      {/* Uploader */}
      {isOverLimit ? (
        <div className="mb-10 rounded-xl border-2 border-dashed border-neutral-200 p-10 text-center">
          <p className="text-sm text-neutral-500">
            You have used all {user?.max_interactions} interactions. Uploads are disabled.
          </p>
        </div>
      ) : (
        <div className="mb-10">
          <FileUploader onUpload={handleUpload} />
        </div>
      )}

      {/* Document list */}
      <div>
        <h2 className="text-base font-semibold text-neutral-900 mb-4">
          Your Documents {!loadingDocs && `(${documents.length})`}
        </h2>

        {loadingDocs ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-900" />
          </div>
        ) : documents.length === 0 ? (
          <div className="rounded-xl border border-neutral-200 py-12 text-center">
            <p className="text-sm text-neutral-400">No documents uploaded yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {documents.map((doc) => (
              <div
                key={doc.id}
                onClick={() => setSelectedDoc(selectedDoc?.id === doc.id ? null : doc)}
                className={`cursor-pointer rounded-xl border bg-white p-4 transition-all hover:border-neutral-400 ${
                  selectedDoc?.id === doc.id
                    ? "border-neutral-900"
                    : "border-neutral-200"
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-50">
                    {getFileIcon(doc.file_type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-neutral-900 truncate">
                      {doc.filename}
                    </p>
                    <p className="text-xs text-neutral-400">
                      Uploaded{" "}
                      {new Date(doc.upload_timestamp).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  {getStatusBadge(doc.processing_status)}
                </div>

                {selectedDoc?.id === doc.id && doc.extracted_data && (
                  <div className="mt-4 rounded-lg bg-neutral-50 p-4 border border-neutral-100">
                    <h4 className="text-xs font-semibold uppercase text-neutral-500 mb-2">
                      Parsed Metadata
                    </h4>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {Object.entries(doc.extracted_data).map(([key, value]) => (
                        <div key={key}>
                          <p className="text-[11px] text-neutral-400 capitalize">
                            {key.replace(/_/g, " ")}
                          </p>
                          <p className="text-sm font-medium text-neutral-800">
                            {String(value)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
