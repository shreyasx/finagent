const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface UploadResponse {
  document_id: string;
  filename: string;
  status: string;
  metadata?: Record<string, unknown>;
}

interface Document {
  id: string;
  filename: string;
  file_type: string;
  status: "processing" | "completed" | "error";
  uploaded_at: string;
  metadata?: Record<string, unknown>;
}

interface AnalyticsSummary {
  total_documents: number;
  total_invoice_amount: number;
  discrepancies_found: number;
  reports_generated: number;
  monthly_expenses: { month: string; amount: number }[];
  vendor_distribution: { name: string; value: number }[];
  recent_discrepancies: {
    id: string;
    description: string;
    severity: "high" | "medium" | "low";
    document: string;
    date: string;
  }[];
}

interface ReportResponse {
  report_id: string;
  format: string;
  download_url: string;
}

async function request<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    ...options,
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`API Error ${res.status}: ${error}`);
  }

  return res.json();
}

export async function uploadDocument(
  file: File,
  onProgress?: (progress: number) => void
): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append("file", file);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE}/api/documents/upload`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText));
      } else {
        reject(new Error(`Upload failed: ${xhr.statusText}`));
      }
    };

    xhr.onerror = () => reject(new Error("Upload failed"));
    xhr.send(formData);
  });
}

export async function getDocuments(): Promise<Document[]> {
  return request<Document[]>("/api/documents");
}

export async function getAnalyticsSummary(): Promise<AnalyticsSummary> {
  return request<AnalyticsSummary>("/api/analytics/summary");
}

export async function generateReport(params: {
  document_ids?: string[];
  report_type: string;
  format: string;
}): Promise<ReportResponse> {
  return request<ReportResponse>("/api/reports/generate", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function exportReport(
  reportId: string,
  format: string
): Promise<Blob> {
  const res = await fetch(
    `${API_BASE}/api/reports/${reportId}/export?format=${format}`
  );
  if (!res.ok) throw new Error("Export failed");
  return res.blob();
}

export type { UploadResponse, Document, AnalyticsSummary, ReportResponse };
