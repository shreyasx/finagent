"use client";

import { useState, useCallback, useRef } from "react";
import { Upload, X, FileText, FileSpreadsheet, CheckCircle, AlertCircle } from "lucide-react";

interface UploadingFile {
  file: File;
  progress: number;
  status: "uploading" | "completed" | "error";
  error?: string;
}

interface FileUploaderProps {
  onUpload: (file: File, onProgress: (progress: number) => void) => Promise<void>;
}

const ALLOWED_TYPES = [
  "application/pdf",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
];

const ALLOWED_EXTENSIONS = [".pdf", ".csv", ".xlsx", ".xls"];

function getFileIcon(name: string) {
  if (name.endsWith(".pdf")) return <FileText className="h-5 w-5 text-neutral-700" />;
  return <FileSpreadsheet className="h-5 w-5 text-neutral-500" />;
}

export default function FileUploader({ onUpload }: FileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<UploadingFile[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        return "Unsupported file type. Use PDF, CSV, or XLSX.";
      }
    }
    if (file.size > 50 * 1024 * 1024) {
      return "File too large. Max size is 50 MB.";
    }
    return null;
  };

  const handleFiles = useCallback(
    async (fileList: FileList) => {
      const newFiles = Array.from(fileList);

      for (const file of newFiles) {
        const error = validateFile(file);
        if (error) {
          setFiles((prev) => [
            ...prev,
            { file, progress: 0, status: "error", error },
          ]);
          continue;
        }

        const uploadEntry: UploadingFile = {
          file,
          progress: 0,
          status: "uploading",
        };

        setFiles((prev) => [...prev, uploadEntry]);

        try {
          await onUpload(file, (progress) => {
            setFiles((prev) =>
              prev.map((f) =>
                f.file === file ? { ...f, progress } : f
              )
            );
          });

          setFiles((prev) =>
            prev.map((f) =>
              f.file === file ? { ...f, progress: 100, status: "completed" } : f
            )
          );
        } catch {
          setFiles((prev) =>
            prev.map((f) =>
              f.file === file
                ? { ...f, status: "error", error: "Upload failed" }
                : f
            )
          );
        }
      }
    },
    [onUpload]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files.length) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles]
  );

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`relative cursor-pointer rounded-xl border-2 border-dashed p-10 text-center transition-all ${
          isDragging
            ? "border-neutral-900 bg-neutral-50 scale-[1.01]"
            : "border-neutral-300 hover:border-neutral-900 hover:bg-neutral-50"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.csv,.xlsx,.xls"
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
        <Upload
          className={`mx-auto h-10 w-10 ${
            isDragging ? "text-neutral-900" : "text-neutral-400"
          }`}
        />
        <p className="mt-3 text-sm font-medium text-neutral-700">
          Drag and drop files here, or{" "}
          <span className="text-neutral-900 underline">browse</span>
        </p>
        <p className="mt-1 text-xs text-neutral-400">
          Supports PDF, CSV, XLSX -- Max 50 MB
        </p>
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((item, index) => (
            <div
              key={index}
              className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-white p-3"
            >
              {getFileIcon(item.file.name)}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-neutral-700 truncate">
                  {item.file.name}
                </p>
                <p className="text-xs text-neutral-400">
                  {(item.file.size / 1024).toFixed(1)} KB
                </p>
                {item.status === "uploading" && (
                  <div className="mt-1.5 h-1.5 w-full rounded-full bg-neutral-100">
                    <div
                      className="h-1.5 rounded-full bg-neutral-900 transition-all duration-300"
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                )}
                {item.status === "error" && (
                  <p className="mt-0.5 text-xs text-neutral-500">{item.error}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {item.status === "completed" && (
                  <CheckCircle className="h-5 w-5 text-neutral-900" />
                )}
                {item.status === "error" && (
                  <AlertCircle className="h-5 w-5 text-neutral-400" />
                )}
                {item.status === "uploading" && (
                  <span className="text-xs text-neutral-400">{item.progress}%</span>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(index);
                  }}
                  className="rounded p-1 hover:bg-neutral-100 text-neutral-400 hover:text-neutral-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
