"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  MessageSquare,
  Upload,
  BarChart3,
  Menu,
  X,
} from "lucide-react";
import DocumentSidebar from "@/components/DocumentSidebar";
import type { DocumentItem } from "@/components/DocumentSidebar";
import "./globals.css";

const navLinks = [
  { href: "/", label: "Chat", icon: MessageSquare },
  { href: "/upload", label: "Upload", icon: Upload },
  { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
];

// Mock documents for sidebar display
const mockDocuments: DocumentItem[] = [
  { id: "1", filename: "Q4_Invoice_Acme.pdf", file_type: "pdf", status: "completed" },
  { id: "2", filename: "Vendor_Payments_2024.xlsx", file_type: "xlsx", status: "completed" },
  { id: "3", filename: "Expense_Report_Jan.csv", file_type: "csv", status: "processing" },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [documents, setDocuments] = useState<DocumentItem[]>(mockDocuments);

  // Close mobile sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  // Listen for document updates from the upload page
  useEffect(() => {
    const handler = (e: CustomEvent<DocumentItem>) => {
      setDocuments((prev) => {
        const exists = prev.find((d) => d.id === e.detail.id);
        if (exists) {
          return prev.map((d) => (d.id === e.detail.id ? e.detail : d));
        }
        return [...prev, e.detail];
      });
    };

    window.addEventListener("document-update" as string, handler as EventListener);
    return () =>
      window.removeEventListener("document-update" as string, handler as EventListener);
  }, []);

  return (
    <html lang="en">
      <body className="antialiased">
        <div className="flex h-screen overflow-hidden">
          {/* Mobile overlay */}
          {sidebarOpen && (
            <div
              className="fixed inset-0 z-40 bg-black/50 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
          )}

          {/* Sidebar */}
          <aside
            className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-sidebar-bg text-sidebar-text transition-transform lg:static lg:translate-x-0 ${
              sidebarOpen ? "translate-x-0" : "-translate-x-full"
            }`}
          >
            {/* Logo */}
            <div className="flex h-16 items-center justify-between border-b border-slate-700 px-4">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                  <BarChart3 className="h-4 w-4 text-white" />
                </div>
                <span className="text-lg font-bold tracking-tight">
                  FinAgent
                </span>
              </div>
              <button
                className="lg:hidden p-1 hover:bg-sidebar-hover rounded"
                onClick={() => setSidebarOpen(false)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 space-y-1 px-2 py-4">
              {navLinks.map((link) => {
                const isActive = pathname === link.href;
                const Icon = link.icon;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-sidebar-active text-white"
                        : "text-slate-300 hover:bg-sidebar-hover hover:text-white"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    {link.label}
                  </Link>
                );
              })}
            </nav>

            {/* Documents section */}
            <div className="border-t border-slate-700 py-3">
              <h3 className="px-4 text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Documents
              </h3>
              <DocumentSidebar documents={documents} />
            </div>

            {/* Footer */}
            <div className="border-t border-slate-700 p-4">
              <p className="text-[10px] text-slate-500">
                FinAgent v1.0 -- Agentic Finance
              </p>
            </div>
          </aside>

          {/* Main content */}
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* Top bar (mobile) */}
            <header className="flex h-14 items-center border-b border-gray-200 bg-white px-4 lg:hidden">
              <button
                onClick={() => setSidebarOpen(true)}
                className="rounded-md p-2 hover:bg-gray-100"
              >
                <Menu className="h-5 w-5 text-gray-600" />
              </button>
              <span className="ml-3 text-sm font-semibold text-gray-800">
                FinAgent
              </span>
            </header>

            {/* Page content */}
            <main className="flex-1 overflow-auto bg-gray-50">
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}
