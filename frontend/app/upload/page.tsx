"use client";

import { useState, useEffect } from "react";
import { Upload as UploadIcon, FileText, FileSpreadsheet, CheckCircle, Clock, AlertCircle, ChevronDown, ChevronRight, Shield, Sparkles } from "lucide-react";
import FileUploader from "@/components/FileUploader";
import { useAuth } from "@/components/AuthProvider";
import { uploadDocument, getDocuments, loadSampleDocuments } from "@/lib/api";

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

const SAMPLE_FILENAMES = [
  "acme_corp_invoice_Q4_001.csv",
  "acme_corp_invoice_Q4_002.csv",
  "bank_statement_Q4_2024.csv",
  "globaltech_invoice_Q4_001.csv",
  "gst_return_Q4_2024.csv",
];

const SAMPLE_DESCRIPTIONS: Record<string, string> = {
  "acme_corp_invoice_Q4_001.csv": "Acme Corp Invoice #INV-2024-001",
  "acme_corp_invoice_Q4_002.csv": "Acme Corp Invoice #INV-2024-002",
  "bank_statement_Q4_2024.csv": "SBI Bank Statement (Oct–Dec 2024)",
  "globaltech_invoice_Q4_001.csv": "GlobalTech Invoice #INV-GT-2024-001",
  "gst_return_Q4_2024.csv": "GST Return Q4 2024",
};

const SUGGESTED_QUERIES = [
  {
    title: "Invoice-to-Bank Reconciliation",
    query: "Reconcile invoices against bank statement and flag mismatches",
    expected: "Flags an INR 500 discrepancy on the GlobalTech payment",
  },
  {
    title: "GST Compliance Summary",
    query: "Summarize GST output tax, input tax, and net liability",
    expected: "Shows output/input tax totals and net GST liability",
  },
  {
    title: "Vendor Aggregation",
    query: "What is the total amount invoiced by Acme Corp?",
    expected: "Aggregates totals across both Acme Corp invoices",
  },
  {
    title: "Cash Flow Analysis",
    query: "Analyze income vs expenses from the bank statement",
    expected: "Breaks down credits (income) vs debits (expenses)",
  },
];

export default function UploadPage() {
  const { user, refreshUser } = useAuth();
  const [documents, setDocuments] = useState<UploadedDoc[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<UploadedDoc | null>(null);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [loadingSamples, setLoadingSamples] = useState(false);
  const [samplesError, setSamplesError] = useState<string | null>(null);
  const [queriesOpen, setQueriesOpen] = useState(false);

  const isOverLimit = user
    ? user.interaction_count >= user.max_interactions
    : false;

  const hasSamples = documents.some((d) => SAMPLE_FILENAMES.includes(d.filename));

  const handleLoadSamples = async () => {
    setLoadingSamples(true);
    setSamplesError(null);
    try {
      const docs = await loadSampleDocuments();
      const newDocs: UploadedDoc[] = docs.map((d) => ({
        id: d.id,
        filename: d.filename,
        file_type: d.file_type,
        processing_status: d.processing_status,
        upload_timestamp: d.upload_timestamp,
        extracted_data: d.extracted_data,
      }));
      setDocuments((prev) => [...newDocs, ...prev]);
      refreshUser();
    } catch (err) {
      setSamplesError(err instanceof Error ? err.message : "Failed to load samples");
    } finally {
      setLoadingSamples(false);
    }
  };

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

      {/* Try it out — sample documents */}
      {!loadingDocs && !hasSamples && !isOverLimit && (
        <div className="mb-10 rounded-xl border border-neutral-200 bg-neutral-50 p-6">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-neutral-600" />
            <h3 className="text-sm font-semibold text-neutral-900">
              Try it out
            </h3>
          </div>
          <p className="text-sm text-neutral-500 mb-4">
            Here to test? Load our sample financial documents — 5 CSVs
            simulating Q4 2024 financials for FinTech Solutions Pvt Ltd with an
            intentional discrepancy to discover.
          </p>

          <ul className="space-y-1.5 mb-5">
            {SAMPLE_FILENAMES.map((fname) => (
              <li key={fname} className="flex items-center gap-2 text-sm text-neutral-600">
                <FileSpreadsheet className="h-3.5 w-3.5 text-neutral-400 shrink-0" />
                {SAMPLE_DESCRIPTIONS[fname] || fname}
              </li>
            ))}
          </ul>

          <button
            onClick={handleLoadSamples}
            disabled={loadingSamples}
            className="inline-flex items-center gap-2 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loadingSamples ? (
              <>
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-neutral-400 border-t-white" />
                Loading...
              </>
            ) : (
              "Load Sample Documents"
            )}
          </button>

          {samplesError && (
            <p className="mt-3 text-sm text-red-600">{samplesError}</p>
          )}
        </div>
      )}

      {/* Suggested queries */}
      {!loadingDocs && hasSamples && (
        <div className="mb-10 rounded-xl border border-neutral-200 bg-white">
          <button
            onClick={() => setQueriesOpen(!queriesOpen)}
            className="flex w-full items-center justify-between p-4 text-left"
          >
            <span className="text-sm font-semibold text-neutral-900">
              Suggested Queries
            </span>
            {queriesOpen ? (
              <ChevronDown className="h-4 w-4 text-neutral-400" />
            ) : (
              <ChevronRight className="h-4 w-4 text-neutral-400" />
            )}
          </button>
          {queriesOpen && (
            <div className="border-t border-neutral-100 px-4 pb-4 pt-3 space-y-3">
              {SUGGESTED_QUERIES.map((sq, i) => (
                <div key={i} className="rounded-lg bg-neutral-50 p-3">
                  <p className="text-sm font-medium text-neutral-800 mb-1">
                    {sq.title}
                  </p>
                  <p className="text-sm text-neutral-600 mb-1.5">
                    <span className="text-neutral-400">Try:</span>{" "}
                    &ldquo;{sq.query}&rdquo;
                  </p>
                  <p className="text-xs text-neutral-400">
                    Expected: {sq.expected}
                  </p>
                </div>
              ))}
            </div>
          )}
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

      {/* Security notice */}
      <div className="mt-10 flex items-start gap-3 rounded-xl border border-neutral-100 bg-neutral-50 p-4">
        <Shield className="h-4 w-4 text-neutral-400 mt-0.5 shrink-0" />
        <p className="text-xs text-neutral-500 leading-relaxed">
          Your documents are secure — stored in isolated private storage,
          accessible only to you. No one else can view or access your files.
        </p>
      </div>
    </div>
  );
}
