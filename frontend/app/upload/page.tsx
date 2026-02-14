"use client";

import { useState } from "react";
import { Upload as UploadIcon, FileText, FileSpreadsheet, CheckCircle, Clock, AlertCircle } from "lucide-react";
import FileUploader from "@/components/FileUploader";
import { uploadDocument } from "@/lib/api";

interface UploadedDoc {
  id: string;
  filename: string;
  file_type: string;
  status: "processing" | "completed" | "error";
  uploaded_at: string;
  metadata?: Record<string, unknown>;
}

// Mock already-uploaded documents
const initialDocs: UploadedDoc[] = [
  {
    id: "1",
    filename: "Q4_Invoice_Acme.pdf",
    file_type: "pdf",
    status: "completed",
    uploaded_at: "2024-12-15T10:30:00Z",
    metadata: {
      pages: 4,
      vendor: "Acme Corp",
      total_amount: "$18,500.00",
      invoice_number: "INV-1042",
    },
  },
  {
    id: "2",
    filename: "Vendor_Payments_2024.xlsx",
    file_type: "xlsx",
    status: "completed",
    uploaded_at: "2024-12-14T09:15:00Z",
    metadata: {
      rows: 156,
      vendors: 12,
      total_payments: "$234,500.00",
    },
  },
  {
    id: "3",
    filename: "Expense_Report_Jan.csv",
    file_type: "csv",
    status: "processing",
    uploaded_at: "2024-12-16T14:45:00Z",
  },
];

function getFileIcon(fileType: string) {
  switch (fileType) {
    case "pdf":
      return <FileText className="h-5 w-5 text-red-500" />;
    case "csv":
    case "xlsx":
      return <FileSpreadsheet className="h-5 w-5 text-green-500" />;
    default:
      return <FileText className="h-5 w-5 text-gray-400" />;
  }
}

function getStatusBadge(status: string) {
  switch (status) {
    case "completed":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700">
          <CheckCircle className="h-3 w-3" />
          Completed
        </span>
      );
    case "processing":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-yellow-50 px-2.5 py-0.5 text-xs font-medium text-yellow-700">
          <Clock className="h-3 w-3 animate-spin" />
          Processing
        </span>
      );
    case "error":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700">
          <AlertCircle className="h-3 w-3" />
          Error
        </span>
      );
    default:
      return null;
  }
}

export default function UploadPage() {
  const [documents, setDocuments] = useState<UploadedDoc[]>(initialDocs);
  const [selectedDoc, setSelectedDoc] = useState<UploadedDoc | null>(null);

  const handleUpload = async (
    file: File,
    onProgress: (progress: number) => void
  ) => {
    const newDoc: UploadedDoc = {
      id: Date.now().toString(),
      filename: file.name,
      file_type: file.name.split(".").pop() || "unknown",
      status: "processing",
      uploaded_at: new Date().toISOString(),
    };

    setDocuments((prev) => [newDoc, ...prev]);

    try {
      await uploadDocument(file, onProgress);
      // Simulate processing completion
      setTimeout(() => {
        setDocuments((prev) =>
          prev.map((d) =>
            d.id === newDoc.id
              ? {
                  ...d,
                  status: "completed" as const,
                  metadata: {
                    pages: Math.floor(Math.random() * 10) + 1,
                    vendor: "Parsed Vendor",
                    total_amount: `$${(Math.random() * 50000).toFixed(2)}`,
                  },
                }
              : d
          )
        );

        // Dispatch event for sidebar update
        window.dispatchEvent(
          new CustomEvent("document-update", {
            detail: { ...newDoc, status: "completed" },
          })
        );
      }, 3000);
    } catch {
      // Simulate local processing on API failure
      let progress = 0;
      const interval = setInterval(() => {
        progress += 10;
        onProgress(Math.min(progress, 100));
        if (progress >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            setDocuments((prev) =>
              prev.map((d) =>
                d.id === newDoc.id
                  ? {
                      ...d,
                      status: "completed" as const,
                      metadata: {
                        pages: Math.floor(Math.random() * 10) + 1,
                        vendor: "Parsed Vendor",
                        total_amount: `$${(Math.random() * 50000).toFixed(2)}`,
                      },
                    }
                  : d
              )
            );
          }, 1000);
        }
      }, 200);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      {/* Page header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <UploadIcon className="h-5 w-5 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Upload Documents</h1>
        </div>
        <p className="text-sm text-gray-500 ml-[52px]">
          Upload financial documents for AI-powered analysis. Supported formats: PDF, CSV, XLSX.
        </p>
      </div>

      {/* Uploader */}
      <div className="mb-10">
        <FileUploader onUpload={handleUpload} />
      </div>

      {/* Document list */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Uploaded Documents ({documents.length})
        </h2>
        <div className="space-y-3">
          {documents.map((doc) => (
            <div
              key={doc.id}
              onClick={() => setSelectedDoc(selectedDoc?.id === doc.id ? null : doc)}
              className={`cursor-pointer rounded-xl border bg-white p-4 transition-all hover:shadow-md ${
                selectedDoc?.id === doc.id
                  ? "border-primary ring-1 ring-primary/20"
                  : "border-gray-200"
              }`}
            >
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-50">
                  {getFileIcon(doc.file_type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {doc.filename}
                  </p>
                  <p className="text-xs text-gray-400">
                    Uploaded{" "}
                    {new Date(doc.uploaded_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                </div>
                {getStatusBadge(doc.status)}
              </div>

              {/* Metadata panel */}
              {selectedDoc?.id === doc.id && doc.metadata && (
                <div className="mt-4 rounded-lg bg-gray-50 p-4 border border-gray-100">
                  <h4 className="text-xs font-semibold uppercase text-gray-500 mb-2">
                    Parsed Metadata
                  </h4>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {Object.entries(doc.metadata).map(([key, value]) => (
                      <div key={key}>
                        <p className="text-[11px] text-gray-400 capitalize">
                          {key.replace(/_/g, " ")}
                        </p>
                        <p className="text-sm font-medium text-gray-800">
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
      </div>
    </div>
  );
}
