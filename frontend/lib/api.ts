import { getToken } from "./auth";

const API_BASE = "";

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
  processing_status: string;
  upload_timestamp: string;
  extracted_data?: Record<string, unknown>;
}

interface ReportResponse {
  report_id: string;
  format: string;
  download_url: string;
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
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

    const token = getToken();
    if (token) {
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    }

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

export async function loadSampleDocuments(): Promise<Document[]> {
  return request<Document[]>("/api/documents/load-samples", {
    method: "POST",
  });
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
    `${API_BASE}/api/reports/${reportId}/export?format=${format}`,
    { headers: authHeaders() }
  );
  if (!res.ok) throw new Error("Export failed");
  return res.blob();
}

export type { UploadResponse, Document, ReportResponse };
