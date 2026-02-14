"use client";

import { useState, useEffect } from "react";
import {
  FileText,
  DollarSign,
  AlertTriangle,
  FileBarChart,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

// Mock data for the dashboard
const summaryCards = [
  {
    title: "Total Documents",
    value: "24",
    change: "+3 this week",
    icon: FileText,
    color: "bg-blue-500",
    bgColor: "bg-blue-50",
    textColor: "text-blue-700",
  },
  {
    title: "Total Invoice Amount",
    value: "$234,580",
    change: "+$18,500 this month",
    icon: DollarSign,
    color: "bg-green-500",
    bgColor: "bg-green-50",
    textColor: "text-green-700",
  },
  {
    title: "Discrepancies Found",
    value: "7",
    change: "2 unresolved",
    icon: AlertTriangle,
    color: "bg-amber-500",
    bgColor: "bg-amber-50",
    textColor: "text-amber-700",
  },
  {
    title: "Reports Generated",
    value: "12",
    change: "Last: 2 days ago",
    icon: FileBarChart,
    color: "bg-purple-500",
    bgColor: "bg-purple-50",
    textColor: "text-purple-700",
  },
];

const monthlyExpenses = [
  { month: "Jul", amount: 28400 },
  { month: "Aug", amount: 32100 },
  { month: "Sep", amount: 27800 },
  { month: "Oct", amount: 35600 },
  { month: "Nov", amount: 41200 },
  { month: "Dec", amount: 38900 },
  { month: "Jan", amount: 30500 },
];

const vendorDistribution = [
  { name: "Acme Corp", value: 45230 },
  { name: "GlobalTech", value: 38400 },
  { name: "DataFlow Inc", value: 28900 },
  { name: "NetServe Pro", value: 22100 },
  { name: "CloudBase", value: 15600 },
  { name: "Others", value: 18350 },
];

const PIE_COLORS = ["#2563eb", "#3b82f6", "#60a5fa", "#93c5fd", "#bfdbfe", "#dbeafe"];

const recentDiscrepancies = [
  {
    id: "D-001",
    description: "Payment amount mismatch for GlobalTech invoice #GT-2024-089",
    severity: "high" as const,
    document: "Vendor_Payments_2024.xlsx",
    date: "2024-12-15",
    amount: "$500.00",
  },
  {
    id: "D-002",
    description: "Duplicate invoice entry for DataFlow Inc (#DF-2087)",
    severity: "high" as const,
    document: "Expense_Report_Jan.csv",
    date: "2024-12-14",
    amount: "$8,200.00",
  },
  {
    id: "D-003",
    description: "Missing tax line item on Acme Corp invoice #1042",
    severity: "medium" as const,
    document: "Q4_Invoice_Acme.pdf",
    date: "2024-12-13",
    amount: "$1,850.00",
  },
  {
    id: "D-004",
    description: "Date discrepancy between PO and invoice for NetServe",
    severity: "low" as const,
    document: "Vendor_Payments_2024.xlsx",
    date: "2024-12-12",
    amount: "--",
  },
  {
    id: "D-005",
    description: "Rounding difference in CloudBase monthly billing",
    severity: "low" as const,
    document: "Expense_Report_Jan.csv",
    date: "2024-12-10",
    amount: "$0.03",
  },
];

function getSeverityBadge(severity: "high" | "medium" | "low") {
  const styles = {
    high: "bg-red-50 text-red-700 border-red-200",
    medium: "bg-yellow-50 text-yellow-700 border-yellow-200",
    low: "bg-gray-50 text-gray-600 border-gray-200",
  };

  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase ${styles[severity]}`}
    >
      {severity}
    </span>
  );
}

export default function DashboardPage() {
  const [mounted, setMounted] = useState(false);

  // Prevent SSR hydration mismatch for Recharts
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">
          Financial document analytics and insights
        </p>
      </div>

      {/* Summary cards */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.title}
              className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    {card.title}
                  </p>
                  <p className="mt-2 text-2xl font-bold text-gray-900">
                    {card.value}
                  </p>
                  <p className={`mt-1 text-xs ${card.textColor}`}>
                    {card.change}
                  </p>
                </div>
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-xl ${card.bgColor}`}
                >
                  <Icon className={`h-6 w-6 ${card.textColor}`} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts */}
      <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Bar chart - Monthly Expenses */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">
            Monthly Expenses
          </h3>
          {mounted ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={monthlyExpenses}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 12, fill: "#64748b" }}
                  axisLine={{ stroke: "#e2e8f0" }}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: "#64748b" }}
                  axisLine={{ stroke: "#e2e8f0" }}
                  tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(value) => [
                    `$${Number(value).toLocaleString()}`,
                    "Amount",
                  ]}
                  contentStyle={{
                    borderRadius: "8px",
                    border: "1px solid #e2e8f0",
                    fontSize: "12px",
                  }}
                />
                <Bar
                  dataKey="amount"
                  fill="#2563eb"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={48}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[280px] flex items-center justify-center text-gray-400 text-sm">
              Loading chart...
            </div>
          )}
        </div>

        {/* Pie chart - Vendor Distribution */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">
            Vendor Distribution
          </h3>
          {mounted ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={vendorDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {vendorDistribution.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={PIE_COLORS[index % PIE_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => [
                    `$${Number(value).toLocaleString()}`,
                    "Amount",
                  ]}
                  contentStyle={{
                    borderRadius: "8px",
                    border: "1px solid #e2e8f0",
                    fontSize: "12px",
                  }}
                />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  iconType="circle"
                  iconSize={8}
                  formatter={(value) => (
                    <span className="text-xs text-gray-600">{value}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[280px] flex items-center justify-center text-gray-400 text-sm">
              Loading chart...
            </div>
          )}
        </div>
      </div>

      {/* Recent Discrepancies */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-4">
          <h3 className="text-sm font-semibold text-gray-900">
            Recent Discrepancies
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Issues detected across your financial documents
          </p>
        </div>
        <div className="divide-y divide-gray-100">
          {recentDiscrepancies.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-50">
                <AlertTriangle
                  className={`h-4 w-4 ${
                    item.severity === "high"
                      ? "text-red-500"
                      : item.severity === "medium"
                      ? "text-yellow-500"
                      : "text-gray-400"
                  }`}
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-800">{item.description}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {item.document} -- {new Date(item.date).toLocaleDateString()}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-medium text-gray-900 mb-1">
                  {item.amount}
                </p>
                {getSeverityBadge(item.severity)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
