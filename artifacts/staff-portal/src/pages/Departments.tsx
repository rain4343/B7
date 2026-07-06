import React, { useState } from "react";
import { Building2, Pencil, Trash2, Plus, Eye } from "lucide-react";
import { Link } from "wouter";
import {
  useListDepartments, getListDepartmentsQueryKey,
  useCreateDepartment, useUpdateDepartment, useDeleteDepartment,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const ku: React.CSSProperties = { fontFamily: "'Noto Kufi Arabic', sans-serif" };

const deptColors = [
  "bg-blue-500/10 text-blue-600 border-blue-500/20",
  "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  "bg-violet-500/10 text-violet-600 border-violet-500/20",
  "bg-amber-500/10 text-amber-600 border-amber-500/20",
  "bg-rose-500/10 text-rose-600 border-rose-500/20",
  "bg-cyan-500/10 text-cyan-600 border-cyan-500/20",
];

const deptIcons = [
  "bg-blue-500", "bg-emerald-500", "bg-violet-500",
  "bg-amber-500", "bg-rose-500", "bg-cyan-500",
];

export default function Departments() {
  const { data: departments, isLoading, refetch } = useListDepartments({ query: { queryKey: getListDepartmentsQueryKey() } });
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<{ id: number; name: string } | null>(null);
  const [deptName, setDeptName] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const createMutation = useCreateDepartment({
    mutation: {
      onSuccess: () => { toast({ title: "هۆبەکە بە سەرکەوتوویی دروستکرا." }); refetch(); closeDialog(); },
      onError: (e: any) => toast({ title: "هەڵە", description: e.message, variant: "destructive" }),
    },
  });
  const updateMutation = useUpdateDepartment({
    mutation: {
      onSuccess: () => { toast({ title: "هۆبەکە نوێکرایەوە." }); refetch(); closeDialog(); },
      onError: (e: any) => toast({ title: "هەڵە", description: e.message, variant: "destructive" }),
    },
  });
  const deleteMutation = useDeleteDepartment({
    mutation: {
      onSuccess: () => { toast({ title: "هۆبەکە سڕایەوە." }); refetch(); setDeleteId(null); },
      onError: (e: any) => { toast({ title: "هەڵە", description: e.message, variant: "destructive" }); setDeleteId(null); },
    },
  });

  const openNew = () => { setEditingDept(null); setDeptName(""); setDialogOpen(true); };
  const openEdit = (dept: any) => { setEditingDept(dept); setDeptName(dept.name); setDialogOpen(true); };
  const closeDialog = () => { setDialogOpen(false); setEditingDept(null); setDeptName(""); };
  const saveDept = () => {
    if (!deptName.trim()) return;
    if (editingDept) updateMutation.mutate({ id: editingDept.id, data: { name: deptName } });
    else createMutation.mutate({ data: { name: deptName } });
  };

  return (
    <div className="space-y-6" data-testid="page-departments" style={ku}>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-emerald-500/10 p-2.5">
            <Building2 className="h-6 w-6 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">بەڕێوەبردنی هۆبەکان</h1>
            <p className="text-sm text-muted-foreground mt-0.5">بەڕێوەبردنی یەکەکانی ڕێکخراوەکە.</p>
          </div>
        </div>
        <Button onClick={openNew} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 shadow-sm">
          <Plus className="h-4 w-4" />
          دروستکردنی هۆبەی نوێ
        </Button>
      </div>

      {/* Cards Grid */}
      {isLoading ? (
        <div className="py-16 text-center text-muted-foreground">چاوەڕێ بکە...</div>
      ) : !departments?.length ? (
        <div className="py-16 text-center">
          <Building2 className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">هیچ هۆبەیەک نەدۆزرایەوە!</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {departments.map((dept, index) => {
            const colorIdx = index % deptColors.length;
            return (
              <div key={dept.id} className="bg-card border border-border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow group relative">
                {/* Icon */}
                <div className={`w-10 h-10 rounded-xl ${deptIcons[colorIdx]} flex items-center justify-center mb-4`}>
                  <Building2 className="h-5 w-5 text-white" />
                </div>

                {/* Name */}
                <Link href={`/departments/${dept.id}`}>
                  <h3 className="font-semibold text-foreground text-base hover:text-blue-600 transition-colors cursor-pointer mb-1">
                    {dept.name}
                  </h3>
                </Link>
                <p className="text-xs text-muted-foreground">
                  دروستکراوە: {format(new Date(dept.created_at), "MMM d, yyyy")}
                </p>

                {/* Badge */}
                <span className={`inline-flex items-center mt-3 px-2 py-0.5 rounded-md text-[11px] font-medium border ${deptColors[colorIdx]}`}>
                  هۆبەی ڕێکخراوەکە
                </span>

                {/* Actions */}
                <div className="absolute top-4 left-4 flex gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" asChild aria-label="بینینی فەرمانبەران">
                    <Link href={`/departments/${dept.id}`}>
                      <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                    </Link>
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(dept)} aria-label="دەستکاریکردن">
                    <Pencil className="h-3.5 w-3.5 text-blue-600" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDeleteId(dept.id)} aria-label="سڕینەوە">
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Count */}
      {departments && departments.length > 0 && (
        <p className="text-xs text-muted-foreground text-right">کۆی {departments.length} هۆبە</p>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent style={ku}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-emerald-600" />
              {editingDept ? "دەستکاریکردنی هۆبە" : "دروستکردنی هۆبەی نوێ"}
            </DialogTitle>
            <DialogDescription>
              {editingDept ? "ناوی هۆبەکە بگۆڕە." : "هۆبەیەکی نوێ دروست بکە بۆ ڕێکخراوەکە."}
            </DialogDescription>
          </DialogHeader>
          <div className="py-3">
            <label className="text-sm font-medium mb-1.5 block">ناوی هۆبە</label>
            <Input
              placeholder="بۆ نموونە: هۆبەی ژمێریاری"
              value={deptName}
              onChange={e => setDeptName(e.target.value)}
              autoFocus
              onKeyDown={e => e.key === "Enter" && saveDept()}
              className="text-right"
              style={ku}
            />
          </div>
          <DialogFooter className="flex-row-reverse gap-2">
            <Button variant="outline" onClick={closeDialog} style={ku}>پاشگەزبوونەوە</Button>
            <Button
              onClick={saveDept}
              disabled={createMutation.isPending || updateMutation.isPending || !deptName.trim()}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              style={ku}
            >
              پاشەکەوتکردن
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent style={ku}>
          <AlertDialogHeader>
            <AlertDialogTitle>سڕینەوەی هۆبە؟</AlertDialogTitle>
            <AlertDialogDescription>
              دڵنیایت؟ هۆبەکە بە تەواوی دەسڕێتەوە. فەرمانبەرانی ئەم هۆبەیە بێ هۆبە دەبن.
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
