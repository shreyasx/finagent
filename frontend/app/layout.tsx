"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { MessageSquare, Upload, LogOut } from "lucide-react";
import { AuthProvider, useAuth } from "@/components/AuthProvider";
import "./globals.css";

const navLinks = [
  { href: "/", label: "Chat", icon: MessageSquare },
  { href: "/upload", label: "Upload", icon: Upload },
];

const authPages = ["/login", "/signup", "/verify"];

function Navbar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  if (authPages.includes(pathname)) return null;

  return (
    <header className="flex h-14 items-center justify-between border-b border-neutral-200 bg-white px-6">
      <div className="flex items-center gap-8">
        <Link href="/" className="text-lg font-bold tracking-tight text-neutral-900">
          finAgent
        </Link>
        <nav className="flex items-center gap-1">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-neutral-900 text-white"
                    : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
                }`}
              >
                <Icon className="h-4 w-4" />
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
      {user && (
        <div className="flex items-center gap-4">
          <span className="text-xs text-neutral-400 tabular-nums">
            {user.max_interactions - user.interaction_count}/{user.max_interactions} left
          </span>
          <span className="text-xs text-neutral-500">{user.email}</span>
          <button
            onClick={logout}
            className="rounded-md p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
            title="Log out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      )}
    </header>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <AuthProvider>
          <div className="flex h-screen flex-col overflow-hidden">
            <Navbar />
            <main className="flex-1 overflow-auto bg-white">
              {children}
            </main>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
