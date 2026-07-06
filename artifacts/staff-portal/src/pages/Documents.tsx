import React, { useState } from "react";
import { Link } from "wouter";
import { FileText, Plus, Search, Eye, Trash2 } from "lucide-react";
import { useListDocuments, getListDocumentsQueryKey, useDeleteDocument } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const ku: React.CSSProperties = { fontFamily: "'Noto Kufi Arabic', sans-serif" };

const statusOptions = ["نوێ", "لە پێداچوونەوەدایە", "پەسەندکراوە", "ڕەتکراوەتەوە", "کۆتاییهاتووە"];

function statusBadge(status: string) {
  if (status === "پەسەندکراوە" || status.includes("ئەنجامدرا"))
    return "bg-emerald-500/10 text-emerald-700 border-emerald-500/20";
  if (status === "ڕەتکراوەتەوە")
    return "bg-rose-500/10 text-rose-700 border-rose-500/20";
  if (status === "لە پێداچوونەوەدایە" || status.includes("ئاڕاستەکرا"))
    return "bg-amber-500/10 text-amber-700 border-amber-500/20";
  if (status === "کۆتاییهاتووە")
    return "bg-slate-500/10 text-slate-600 border-slate-500/20";
  return "bg-blue-500/10 text-blue-700 border-blue-500/20"; // نوێ
}

export default function Documents() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const { toast } = useToast();

  const queryParams = {
    ...(search && { search }),
    ...(statusFilter !== "all" && { status: statusFilter }),
  };

  const { data: documents, isLoading, refetch } = useListDocuments(queryParams, { query: { queryKey: getListDocumentsQueryKey(queryParams) } });

  const deleteMutation = useDeleteDocument({
    mutation: {
      onSuccess: () => { toast({ title: "نوسراوەکە بە سەرکەوتوویی سڕایەوە." }); refetch(); setDeleteId(null); },
      onError: (err: any) => { toast({ title: "هەڵە لە سڕینەوە.", description: err.message, variant: "destructive" }); setDeleteId(null); },
    },
  });

  return (
    <div className="space-y-6" data-testid="page-documents" style={ku}>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-violet-500/10 p-2.5">
            <FileText className="h-6 w-6 text-violet-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">بەڕێوەبردنی نوسراوەکان</h1>
            <p className="text-sm text-muted-foreground mt-0.5">نوسراوی فەرمی و کاغەزەکانی ڕێکخراوەکە بەدواداچوون بکە.</p>
          </div>
        </div>
        <Button asChild className="bg-violet-600 hover:bg-violet-700 text-white gap-2 shadow-sm">
          <Link href="/documents/new">
            <Plus className="h-4 w-4" />
            زیادکردنی نوسراوی نوێ
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 p-4 bg-card border border-border rounded-xl shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="گەڕان بە بابەت..."
            className="pr-9 text-right bg-background"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={ku}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[200px] bg-background" style={ku}>
            <SelectValue placeholder="دۆخی نوسراو" />
          </SelectTrigger>
          <SelectContent style={ku}>
            <SelectItem value="all">هەموو دۆخەکان</SelectItem>
            {statusOptions.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-xs border-b border-border">
              <tr>
                <th className="px-5 py-3.5 font-medium text-right">ژ. نوسراو</th>
                <th className="px-5 py-3.5 font-medium text-right">ڕێکەوت</th>
                <th className="px-5 py-3.5 font-medium text-right">بابەت</th>
                <th className="px-5 py-3.5 font-medium text-right">دروستکەر</th>
                <th className="px-5 py-3.5 font-medium text-right">دۆخ</th>
                <th className="px-5 py-3.5 font-medium text-right">کردار</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr><td colSpan={6} className="px-5 py-14 text-center text-muted-foreground">چاوەڕێ بکە...</td></tr>
              ) : !documents?.length ? (
                <tr>
                  <td colSpan={6} className="px-5 py-14 text-center">
                    <FileText className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-muted-foreground">هیچ نوسراوێک نەدۆزرایەوە!</p>
                  </td>
                </tr>
              ) : (
                documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-muted/30 transition-colors group">
                    <td className="px-5 py-3.5 text-right font-semibold">
                      <Link href={`/documents/${doc.id}`} className="text-violet-600 hover:text-violet-700 hover:underline">
                        {doc.document_number}
                      </Link>
                    </td>
                    <td className="px-5 py-3.5 text-right text-muted-foreground text-xs">
                      {format(new Date(doc.document_date), "yyyy-MM-dd")}
                    </td>
                    <td className="px-5 py-3.5 text-right text-foreground max-w-[200px] truncate">{doc.subject}</td>
                    <td className="px-5 py-3.5 text-right text-muted-foreground text-xs">{doc.creator_name || "—"}</td>
                    <td className="px-5 py-3.5 text-right">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium border ${statusBadge(doc.current_status)}`}>
                        {doc.current_status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button variant="outline" size="sm" asChild className="h-8 text-xs" style={ku}>
                          <Link href={`/documents/${doc.id}`}>
                            <Eye className="h-3.5 w-3.5 ml-1" /> بینین
                          </Link>
                        </Button>
                        <Button
                          variant="ghost" size="icon"
                          onClick={() => setDeleteId(doc.id)}
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          aria-label="سڕینەوەی نوسراو"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {documents && documents.length > 0 && (
          <div className="px-5 py-3 border-t border-border bg-muted/20 text-xs text-muted-foreground text-right">
            کۆی {documents.length} نوسراو
          </div>
        )}
      </div>

      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent style={ku}>
          <AlertDialogHeader>
            <AlertDialogTitle>دڵنیایت لە سڕینەوە؟</AlertDialogTitle>
            <AlertDialogDescription>
              ئەم کردارە گەڕانەوەی نییە. نوسراوەکە و هەموو تۆمارەکانی بە تەواوی دەسڕێتەوە.
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
