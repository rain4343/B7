import React, { useState } from "react";
import { Link } from "wouter";
import { Search, Plus, Building2, Shield, MoreHorizontal, Pencil, Trash2, Users, FileSpreadsheet } from "lucide-react";
import { ImportStaffModal } from "@/components/ImportStaffModal";
import { useListUsers, getListUsersQueryKey, useDeleteUser, useListDepartments, getListDepartmentsQueryKey, useListRoles, getListRolesQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

const ku: React.CSSProperties = { fontFamily: "'Noto Kufi Arabic', sans-serif" };

const avatarColors = [
  "bg-blue-500", "bg-emerald-500", "bg-violet-500",
  "bg-amber-500", "bg-rose-500", "bg-cyan-500", "bg-pink-500", "bg-teal-500",
];

function InitialAvatar({ name }: { name: string }) {
  const initials = name.trim().split(" ").slice(0, 2).map(w => w[0]).join("");
  const idx = name.charCodeAt(0) % avatarColors.length;
  return (
    <span className={`inline-flex items-center justify-center w-9 h-9 rounded-full text-white text-sm font-bold shrink-0 ${avatarColors[idx]}`}>
      {initials || "?"}
    </span>
  );
}

export default function StaffList() {
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState<string>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const { toast } = useToast();

  const queryParams = {
    ...(search && { search }),
    ...(deptFilter !== "all" && { department_id: Number(deptFilter) }),
    ...(roleFilter !== "all" && { role_id: Number(roleFilter) }),
  };

  const { data: users, isLoading, refetch } = useListUsers(queryParams, { query: { enabled: true, queryKey: getListUsersQueryKey(queryParams) } });
  const { data: departments } = useListDepartments({ query: { queryKey: getListDepartmentsQueryKey() } });
  const { data: roles } = useListRoles({ query: { queryKey: getListRolesQueryKey() } });

  const deleteMutation = useDeleteUser({
    mutation: {
      onSuccess: () => {
        toast({ title: "فەرمانبەرەکە بە سەرکەوتوویی سڕایەوە." });
        refetch();
        setDeleteId(null);
      },
      onError: (err: any) => {
        toast({ title: "هەڵە لە سڕینەوە.", description: err.message, variant: "destructive" });
        setDeleteId(null);
      }
    }
  });

  return (
    <div className="space-y-6" data-testid="page-staff-list" style={ku}>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-blue-500/10 p-2.5">
            <Users className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">لیستی فەرمانبەران</h1>
            <p className="text-sm text-muted-foreground mt-0.5">بەڕێوەبردنی فەرمانبەران، هۆبەکان، و ڕۆڵەکان.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2 border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10" onClick={() => setImportOpen(true)}>
            <FileSpreadsheet className="h-4 w-4" />
            هاوردەکردن لە ئیکسڵەوە
          </Button>
          <Button asChild className="bg-blue-600 hover:bg-blue-700 text-white gap-2 shadow-sm">
            <Link href="/staff/new">
              <Plus className="h-4 w-4" />
              زیادکردنی فەرمانبەری نوێ
            </Link>
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 p-4 bg-card border border-border rounded-xl shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="گەڕان بە ناو، ئیمەیڵ، یان ناوی بەکارهێنەر..."
            className="pr-9 text-right bg-background"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={ku}
          />
        </div>
        <Select value={deptFilter} onValueChange={setDeptFilter}>
          <SelectTrigger className="w-full sm:w-[190px] bg-background" style={ku}>
            <Building2 className="h-4 w-4 ml-2 text-emerald-600" />
            <SelectValue placeholder="هۆبە" />
          </SelectTrigger>
          <SelectContent style={ku}>
            <SelectItem value="all">هەموو هۆبەکان</SelectItem>
            {departments?.map(dept => (
              <SelectItem key={dept.id} value={dept.id.toString()}>{dept.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-full sm:w-[190px] bg-background" style={ku}>
            <Shield className="h-4 w-4 ml-2 text-violet-600" />
            <SelectValue placeholder="ڕۆڵ" />
          </SelectTrigger>
          <SelectContent style={ku}>
            <SelectItem value="all">هەموو ڕۆڵەکان</SelectItem>
            {roles?.map(role => (
              <SelectItem key={role.id} value={role.id.toString()}>{role.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="border border-border rounded-xl bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-xs border-b border-border">
              <tr>
                <th className="px-5 py-3.5 font-medium text-right">#</th>
                <th className="px-5 py-3.5 font-medium text-right">فەرمانبەر</th>
                <th className="px-5 py-3.5 font-medium text-right">هۆبە</th>
                <th className="px-5 py-3.5 font-medium text-right">ڕۆڵەکان</th>
                <th className="px-5 py-3.5 font-medium text-right">کردارەکان</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr><td colSpan={5} className="px-5 py-14 text-center text-muted-foreground">چاوەڕێ بکە...</td></tr>
              ) : !users?.length ? (
                <tr>
                  <td colSpan={5} className="px-5 py-14 text-center">
                    <Users className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-muted-foreground">هیچ فەرمانبەرێک نەدۆزرایەوە!</p>
                  </td>
                </tr>
              ) : (
                users.map((user, index) => (
                  <tr key={user.id} className="hover:bg-muted/30 transition-colors group">
                    <td className="px-5 py-4 text-muted-foreground text-right text-xs">{index + 1}</td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center gap-3 justify-end">
                        <div>
                          <div className="font-semibold text-foreground">{user.full_name}</div>
                          <div className="text-[11px] text-muted-foreground mt-0.5">{user.email} · @{user.username}</div>
                        </div>
                        <InitialAvatar name={user.full_name} />
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right">
                      {user.department_name ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-700 border border-emerald-500/20">
                          {user.department_name}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">بێ هۆبە</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex flex-wrap gap-1.5 justify-end">
                        {user.roles && user.roles.length > 0 ? user.roles.map(role => (
                          <span key={role.id} className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-violet-500/10 text-violet-700 border border-violet-500/20">
                            {role.name}
                          </span>
                        )) : (
                          <span className="text-xs text-muted-foreground italic">بێ ڕۆڵ</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="کردارەکان">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" style={ku}>
                          <DropdownMenuItem asChild>
                            <Link href={`/staff/${user.id}`} className="flex items-center cursor-pointer">
                              <Pencil className="ml-2 h-4 w-4 text-blue-500" />
                              دەستکاری
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive focus:bg-destructive/10"
                            onClick={() => setDeleteId(user.id)}
                          >
                            <Trash2 className="ml-2 h-4 w-4" />
                            سڕینەوە
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {users && users.length > 0 && (
          <div className="px-5 py-3 border-t border-border bg-muted/20 text-xs text-muted-foreground text-right">
            کۆی {users.length} فەرمانبەر
          </div>
        )}
      </div>

      <ImportStaffModal open={importOpen} onClose={() => setImportOpen(false)} onImported={() => { refetch(); setImportOpen(false); }} />

      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent style={ku}>
          <AlertDialogHeader>
            <AlertDialogTitle>دڵنیایت لە سڕینەوە؟</AlertDialogTitle>
            <AlertDialogDescription>
              ئەم کردارە گەڕانەوەی نییە. فەرمانبەرەکە بە تەواوی لە سیستەم دەسڕێتەوە.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel style={ku}>پاشگەزبوونەوە</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate({ id: deleteId })}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
              style={ku}
            >
              {deleteMutation.isPending ? "چاوەڕێ بکە..." : "سڕینەوە"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
