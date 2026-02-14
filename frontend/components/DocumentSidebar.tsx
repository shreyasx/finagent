"use client";

import { FileText, FileSpreadsheet, File } from "lucide-react";

interface DocumentItem {
  id: string;
  filename: string;
  file_type: string;
  status: "processing" | "completed" | "error";
}

interface DocumentSidebarProps {
  documents: DocumentItem[];
  onSelect?: (id: string) => void;
}

function getFileIcon(fileType: string) {
  switch (fileType) {
    case "pdf":
      return <FileText className="h-4 w-4 text-red-400" />;
    case "csv":
    case "xlsx":
      return <FileSpreadsheet className="h-4 w-4 text-green-400" />;
    default:
      return <File className="h-4 w-4 text-gray-400" />;
  }
}

function getStatusDot(status: "processing" | "completed" | "error") {
  const colors = {
    processing: "bg-yellow-400",
    completed: "bg-green-400",
    error: "bg-red-400",
  };

  return (
    <span className="relative flex h-2.5 w-2.5">
      {status === "processing" && (
        <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${colors[status]} opacity-75`} />
      )}
      <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${colors[status]}`} />
    </span>
  );
}

export default function DocumentSidebar({ documents, onSelect }: DocumentSidebarProps) {
  if (documents.length === 0) {
    return (
      <div className="px-3 py-4 text-center">
        <p className="text-xs text-slate-400">No documents uploaded yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-1 px-2">
      {documents.map((doc) => (
        <button
          key={doc.id}
          onClick={() => onSelect?.(doc.id)}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-sidebar-hover transition-colors group"
        >
          {getFileIcon(doc.file_type)}
          <span className="flex-1 truncate text-xs text-sidebar-text group-hover:text-white">
            {doc.filename}
          </span>
          {getStatusDot(doc.status)}
        </button>
      ))}
    </div>
  );
}

export type { DocumentItem };
