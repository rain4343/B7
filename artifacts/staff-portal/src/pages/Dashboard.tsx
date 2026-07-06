import React from "react";
import {
  useGetDashboardSummary, getGetDashboardSummaryQueryKey,
  useGetDepartmentBreakdown, getGetDepartmentBreakdownQueryKey,
  useGetRoleBreakdown, getGetRoleBreakdownQueryKey,
  useGetRecentStaff, getGetRecentStaffQueryKey,
} from "@workspace/api-client-react";
import { Users, Building2, Shield, UserCog, TrendingUp, ArrowLeft } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip,
  ResponsiveContainer, Cell, PieChart, Pie, Legend,
} from "recharts";
import { Link } from "wouter";
import { format } from "date-fns";
import { useAuth } from "@/lib/auth";

const ku: React.CSSProperties = { fontFamily: "'Noto Kufi Arabic', sans-serif" };

const CHART_COLORS = ["#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#ef4444"];

function StatCard({
  label, sublabel, value, loading, icon: Icon, colorClass, bgClass,
}: {
  label: string; sublabel: string; value?: number | string; loading?: boolean;
  icon: any; colorClass: string; bgClass: string;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
      <div className={`flex-shrink-0 rounded-xl w-12 h-12 flex items-center justify-center ${bgClass}`}>
        <Icon className={`h-6 w-6 ${colorClass}`} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
        <div className={`text-2xl font-bold ${colorClass}`}>
          {loading ? <span className="opacity-30">—</span> : value}
        </div>
        <p className="text-[11px] text-muted-foreground mt-0.5">{sublabel}</p>
      </div>
    </div>
  );
}

function InitialAvatar({ name }: { name: string }) {
  const initials = name.trim().split(" ").slice(0, 2).map(w => w[0]).join("");
  const colors = ["bg-blue-500", "bg-emerald-500", "bg-violet-500", "bg-amber-500", "bg-rose-500", "bg-cyan-500"];
  const idx = name.charCodeAt(0) % colors.length;
  return (
    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-white text-xs font-bold shrink-0 ${colors[idx]}`}>
      {initials || "?"}
    </span>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { data: summary, isLoading: loadingSummary } = useGetDashboardSummary({ query: { queryKey: getGetDashboardSummaryQueryKey() } });
  const { data: deptBreakdown, isLoading: loadingDept } = useGetDepartmentBreakdown({ query: { queryKey: getGetDepartmentBreakdownQueryKey() } });
  const { data: roleBreakdown, isLoading: loadingRole } = useGetRoleBreakdown({ query: { queryKey: getGetRoleBreakdownQueryKey() } });
  const { data: recentStaff, isLoading: loadingRecent } = useGetRecentStaff({ query: { queryKey: getGetRecentStaffQueryKey() } });

  return (
    <div className="space-y-7" data-testid="page-dashboard" style={ku}>

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-blue-500/10 p-2.5">
          <TrendingUp className="h-6 w-6 text-blue-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            بەخێربێیت، {user?.full_name || user?.username}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">سیستەمی ئی-ڕێکار — داشبۆردی سەرەکی</p>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="کۆی فەرمانبەران"
          sublabel="فەرمانبەری تۆمارکراو"
          value={summary?.total_staff}
          loading={loadingSummary}
          icon={Users}
          colorClass="text-blue-600"
          bgClass="bg-blue-500/10"
        />
        <StatCard
          label="هۆبەکان"
          sublabel="هۆبەی چالاک"
          value={summary?.total_departments}
          loading={loadingSummary}
          icon={Building2}
          colorClass="text-emerald-600"
          bgClass="bg-emerald-500/10"
        />
        <StatCard
          label="ڕۆڵەکان"
          sublabel="ئاستی دەسەڵات"
          value={summary?.total_roles}
          loading={loadingSummary}
          icon={Shield}
          colorClass="text-violet-600"
          bgClass="bg-violet-500/10"
        />
        <StatCard
          label="بەڕێوەبەرانی گشتی"
          sublabel="دەسەڵاتی تەواوی سیستەم"
          value={summary?.super_admin_count}
          loading={loadingSummary}
          icon={UserCog}
          colorClass="text-amber-600"
          bgClass="bg-amber-500/10"
        />
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Dept Bar Chart */}
        <div className="bg-card border border-border rounded-xl shadow-sm">
          <div className="px-5 pt-5 pb-2">
            <h2 className="font-semibold text-base text-foreground">فەرمانبەر بەپێی هۆبە</h2>
            <p className="text-xs text-muted-foreground mt-0.5">دابەشبوونی فەرمانبەران لە نێوان هۆبەکاندا</p>
          </div>
          <div className="h-[260px] px-2 pb-3">
            {loadingDept ? (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">چاوەڕێ بکە...</div>
            ) : !deptBreakdown?.length ? (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">داتایەک نەدۆزرایەوە.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={deptBreakdown} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="department_name" tickLine={false} axisLine={false} fontSize={11}
                    tickMargin={8} tick={{ fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tickLine={false} axisLine={false} fontSize={11} allowDecimals={false}
                    tick={{ fill: "hsl(var(--muted-foreground))" }} />
                  <RechartsTooltip
                    cursor={{ fill: "hsl(var(--muted)/0.5)" }}
                    contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", fontFamily: "'Noto Kufi Arabic', sans-serif", fontSize: 13 }}
                    itemStyle={{ color: "hsl(var(--foreground))" }}
                  />
                  <Bar dataKey="staff_count" radius={[6, 6, 0, 0]} maxBarSize={48}>
                    {deptBreakdown.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Role Pie Chart */}
        <div className="bg-card border border-border rounded-xl shadow-sm">
          <div className="px-5 pt-5 pb-2">
            <h2 className="font-semibold text-base text-foreground">فەرمانبەر بەپێی ڕۆڵ</h2>
            <p className="text-xs text-muted-foreground mt-0.5">دابەشبوونی ڕۆڵەکان لە نێوان فەرمانبەراندا</p>
          </div>
          <div className="h-[260px] pb-3">
            {loadingRole ? (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">چاوەڕێ بکە...</div>
            ) : !roleBreakdown?.length ? (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">داتایەک نەدۆزرایەوە.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={roleBreakdown} dataKey="staff_count" nameKey="role_name"
                    cx="50%" cy="45%" innerRadius={55} outerRadius={90} paddingAngle={3}>
                    {roleBreakdown.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontFamily: "'Noto Kufi Arabic', sans-serif", fontSize: 12 }} />
                  <RechartsTooltip
                    contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", fontFamily: "'Noto Kufi Arabic', sans-serif", fontSize: 13 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Recent Staff */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 flex items-center justify-between border-b border-border">
          <div>
            <h2 className="font-semibold text-base text-foreground">فەرمانبەرانی نوێ</h2>
            <p className="text-xs text-muted-foreground mt-0.5">کۆتا فەرمانبەرانی زیادکراو</p>
          </div>
          <Link href="/staff" className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors">
            بینینی هەمووی
            <ArrowLeft className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-xs border-b border-border">
              <tr>
                <th className="px-5 py-3 font-medium text-right">فەرمانبەر</th>
                <th className="px-5 py-3 font-medium text-right">ناوی بەکارهێنەر</th>
                <th className="px-5 py-3 font-medium text-right">هۆبە</th>
                <th className="px-5 py-3 font-medium text-right">بەرواری زیادکردن</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loadingRecent ? (
                <tr><td colSpan={4} className="px-5 py-10 text-center text-muted-foreground">چاوەڕێ بکە...</td></tr>
              ) : !recentStaff?.length ? (
                <tr><td colSpan={4} className="px-5 py-10 text-center text-muted-foreground">هیچ فەرمانبەرێک نەدۆزرایەوە.</td></tr>
              ) : (
                recentStaff.map((staff) => (
                  <tr key={staff.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center gap-2 justify-end">
                        <div>
                          <div className="font-medium text-foreground">{staff.full_name}</div>
                          <div className="text-[11px] text-muted-foreground">{staff.email}</div>
                        </div>
                        <InitialAvatar name={staff.full_name} />
                      </div>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground text-right">@{staff.username}</td>
                    <td className="px-5 py-3 text-right">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-emerald-500/10 text-emerald-700 border border-emerald-500/20">
                        {staff.department_name || "بێ هۆبە"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground text-right text-xs">
                      {format(new Date(staff.created_at), "MMM d, yyyy")}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
