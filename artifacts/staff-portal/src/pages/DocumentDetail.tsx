import React, { useEffect, useState } from "react";
import { Link, useRoute } from "wouter";
import { useAuth, FORWARD_DOCUMENTS_ROLE } from "@/lib/auth";
import {
  ArrowRight,
  FileText,
  History,
  Plus,
  Download,
  ClipboardList,
  Send,
  Eye,
  Loader2,
  AlertTriangle,
  RefreshCw,
  Upload,
} from "lucide-react";
import {
  useGetDocument,
  getGetDocumentQueryKey,
  useListDocumentLogs,
  getListDocumentLogsQueryKey,
  useCreateDocumentLog,
  useUpdateDocument,
  useForwardDocument,
  useListDepartments,
  getListDepartmentsQueryKey,
  useReplaceDocumentAttachment,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const ku: React.CSSProperties = { fontFamily: "'Noto Kufi Arabic', sans-serif" };

function statusColor(status: string): string {
  if (status === "نوێ") return "bg-blue-500/10 text-blue-500 border-blue-500/20";
  if (status.startsWith("ئاڕاستەکرا بۆ")) return "bg-amber-500/10 text-amber-500 border-amber-500/20";
  if (status === "پەسەندکراوە") return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
  if (status === "ڕەتکراوەتەوە") return "bg-destructive/10 text-destructive border-destructive/20";
  return "bg-muted text-muted-foreground border-border";
}

type PreviewStatus = "idle" | "checking" | "ok" | "error";

export default function DocumentDetail() {
  const [, params] = useRoute("/documents/:id");
  const { user } = useAuth();
  const isSuperAdmin = user?.id === 1;
  const canForward = isSuperAdmin || !!user?.roles?.includes(FORWARD_DOCUMENTS_ROLE);
  const documentId = Number(params?.id);
  const [note, setNote] = useState("");
  const [selectedDept, setSelectedDept] = useState<string>("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewStatus, setPreviewStatus] = useState<PreviewStatus>("idle");
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [newAttachment, setNewAttachment] = useState<File | null>(null);
  const { toast } = useToast();

  const { data: document, isLoading: loadingDoc, refetch: refetchDoc } = useGetDocument(documentId, {
    query: { enabled: !!documentId, queryKey: getGetDocumentQueryKey(documentId) },
  });

  const { data: departments } = useListDepartments({
    query: { queryKey: getListDepartmentsQueryKey() },
  });

  const { data: logs, isLoading: loadingLogs, refetch: refetchLogs } = useListDocumentLogs(documentId, {
    query: { enabled: !!documentId, queryKey: getListDocumentLogsQueryKey(documentId) },
  });

  const updateDocMutation = useUpdateDocument();

  const forwardDocMutation = useForwardDocument({
    mutation: {
      onSuccess: (_data, variables) => {
        const deptName =
          departments?.find((d) => d.id === variables.data.department_id)?.name ?? "";
        setNote("");
        setSelectedDept("");
        toast({ title: "نووسراوەکە بە سەرکەوتوویی ئاڕاستەکرا.", description: deptName });
        refetchLogs();
        refetchDoc();
      },
      onError: (err: any) =>
        toast({ title: "هەڵە", description: err.message, variant: "destructive" }),
    },
  });

  const createLogMutation = useCreateDocumentLog({
    mutation: {
      onSuccess: () => {
        setNote("");
        setSelectedDept("");
        refetchLogs();
        refetchDoc();
      },
      onError: (err: any) =>
        toast({ title: "هەڵە", description: err.message, variant: "destructive" }),
    },
  });

  const replaceAttachmentMutation = useReplaceDocumentAttachment({
    mutation: {
      onSuccess: () => {
        toast({ title: "هاوپێچی نووسراو بە سەرکەوتوویی نوێکرایەوە." });
        setReplaceOpen(false);
        setNewAttachment(null);
        refetchDoc();
        refetchLogs();
      },
      onError: (err: any) =>
        toast({ title: "هەڵە", description: err.message, variant: "destructive" }),
    },
  });

  const isPending =
    createLogMutation.isPending || updateDocMutation.isPending || forwardDocMutation.isPending;

  const replaceAttachment = () => {
    if (!newAttachment || !documentId) return;
    replaceAttachmentMutation.mutate({ id: documentId, data: { attachment: newAttachment } });
  };

  const documentFileUrl = document?.file_path
    ? `/api/documents/uploads/${document.file_path}`
    : null;

  // Pre-flight check before rendering the PDF in an iframe, so we can fall
  // back to the download button if the file is missing or not a PDF.
  useEffect(() => {
    if (!previewOpen || !documentFileUrl) return;
    let cancelled = false;
    setPreviewStatus("checking");
    fetch(documentFileUrl, { credentials: "include" })
      .then((res) => {
        if (cancelled) return;
        const contentType = res.headers.get("content-type") || "";
        if (res.ok && contentType.includes("pdf")) {
          setPreviewStatus("ok");
        } else {
          setPreviewStatus("error");
        }
      })
      .catch(() => {
        if (!cancelled) setPreviewStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [previewOpen, documentFileUrl]);

  // Plain note — no department
  const addNote = () => {
    if (!note.trim()) return;
    createLogMutation.mutate(
      { id: documentId, data: { action: "تێبینی", notes: note || undefined } },
      { onSuccess: () => toast({ title: "تێبینی زیادکرا." }) }
    );
  };

  // Route to department — dedicated forward endpoint (updates status + logs the action)
  const routeToDepartment = () => {
    if (!selectedDept) return;
    forwardDocMutation.mutate({
      id: documentId,
      data: { department_id: Number(selectedDept), notes: note || undefined },
    });
  };

  if (loadingDoc) {
    return (
      <div className="p-8 text-center text-muted-foreground" style={ku}>
        چاوەڕێ بکە...
      </div>
    );
  }

  if (!document) {
    return (
      <div className="text-center p-8" style={ku}>
        <h2 className="text-xl font-bold">نووسراوەکە نەدۆزرایەوە</h2>
        <Button asChild className="mt-4">
          <Link href="/documents">گەڕانەوە بۆ نووسراوەکان</Link>
        </Button>
      </div>
    );
  }

  const fileUrl = documentFileUrl;

  return (
    <div className="space-y-6" data-testid="page-document-detail" style={ku}>
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" asChild>
            <Link href="/documents">
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{document.subject}</h1>
            <p className="text-muted-foreground text-sm mt-0.5">{document.document_number}</p>
          </div>
        </div>
      </div>

      {/* Two-column layout: left 2/3, right 1/3 */}
      <div className="grid gap-6 lg:grid-cols-3">

        {/* ── Left column (2/3): info + new action ── */}
        <div className="lg:col-span-2 space-y-6">

          {/* Document info card */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5 text-muted-foreground" />
                زانیارییەکانی نووسراو
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
                <dt className="text-muted-foreground font-medium">ژمارەی نووسراو:</dt>
                <dd className="font-semibold">{document.document_number}</dd>

                <dt className="text-muted-foreground font-medium">ڕێکەوت:</dt>
                <dd>{format(new Date(document.document_date), "dd / MM / yyyy")}</dd>

                <dt className="text-muted-foreground font-medium">بابەت:</dt>
                <dd>{document.subject}</dd>

                <dt className="text-muted-foreground font-medium">دروستکەر:</dt>
                <dd>{document.creator_name || "—"}</dd>

                <dt className="text-muted-foreground font-medium">دواین حاڵەت:</dt>
                <dd>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium border ${
                      statusColor(document.current_status)
                    }`}
                  >
                    {document.current_status}
                  </span>
                </dd>
              </dl>

              {fileUrl && (
                <>
                  <hr className="my-4" />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setPreviewOpen(true)}
                      className="flex items-center justify-center gap-2 flex-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-3 px-4 text-sm transition-colors"
                      style={ku}
                    >
                      <Eye className="h-4 w-4" />
                      بینین و داگرتنی هاوپێچ (PDF)
                    </button>
                    <a
                      href={fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="داگرتنی هاوپێچ"
                      className="flex items-center justify-center rounded-md border border-emerald-600 text-emerald-600 hover:bg-emerald-50 py-3 px-4 transition-colors"
                    >
                      <Download className="h-4 w-4" />
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        setNewAttachment(null);
                        setReplaceOpen(true);
                      }}
                      title="نوێکردنەوەی هاوپێچ"
                      className="flex items-center justify-center rounded-md border border-muted-foreground/30 text-muted-foreground hover:bg-muted py-3 px-4 transition-colors"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* New action card — forward form, restricted to super admin or users with forwarding permission */}
          {canForward && (
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-muted-foreground" />
                کرداری نوێ: هامش و ئاڕاستەکردن
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Department routing */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground" style={ku}>
                  ئاڕاستەکردن بۆ بەش
                </label>
                <Select value={selectedDept} onValueChange={setSelectedDept}>
                  <SelectTrigger className="text-right" style={ku}>
                    <SelectValue placeholder="بەشێک هەڵبژێرە..." />
                  </SelectTrigger>
                  <SelectContent style={ku}>
                    {departments?.map((dept) => (
                      <SelectItem key={dept.id} value={String(dept.id)}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Notes textarea */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground" style={ku}>
                  هامش
                </label>
                <Textarea
                  placeholder="تێبینییەک بنووسە..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="text-right"
                  style={ku}
                  rows={3}
                />
              </div>

              {/* Actions */}
              <div className="flex gap-2 justify-end">
                {/* Route to department */}
                <Button
                  onClick={routeToDepartment}
                  disabled={isPending || !selectedDept}
                  className="flex items-center gap-2"
                >
                  <Send className="h-4 w-4" />
                  ئاڕاستەکردن
                </Button>
                {/* Plain note (no department required) */}
                <Button
                  variant="outline"
                  onClick={addNote}
                  disabled={isPending || !note.trim()}
                  className="flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  تێبینی
                </Button>
              </div>
            </CardContent>
          </Card>
          )}
        </div>

        {/* ── Right column (1/3): movement history ── */}
        <div className="lg:col-span-1">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <History className="h-5 w-5 text-muted-foreground" />
                مێژووی جووڵەی نووسراو
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingLogs ? (
                <p className="text-center text-muted-foreground py-6 text-sm">چاوەڕێ بکە...</p>
              ) : !logs?.length ? (
                <p className="text-center text-muted-foreground py-6 text-sm">
                  هیچ جووڵەیەک تۆمار نەکراوە.
                </p>
              ) : (
                <ul className="space-y-0 divide-y">
                  {logs.map((log) => (
                    <li key={log.id} className="py-3 first:pt-0 last:pb-0">
                      <p className="font-semibold text-sm">{log.action}</p>
                      <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                        {log.user_name && <span className="block">لەلایەن: {log.user_name}</span>}
                        <span className="block">
                          کات: {format(new Date(log.timestamp), "yyyy/MM/dd - hh:mm a")}
                        </span>
                      </div>
                      {log.notes && (
                        <div className="mt-2 p-2 bg-muted/50 border rounded text-xs">
                          <strong>هامش:</strong>{" "}
                          <span className="italic">{log.notes}</span>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* PDF preview modal */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent
          className="max-w-4xl w-[95vw] h-[85vh] flex flex-col p-0 gap-0"
          style={ku}
        >
          <DialogHeader className="p-4 border-b">
            <DialogTitle className="flex items-center gap-2 text-base" style={ku}>
              <FileText className="h-4 w-4 text-muted-foreground" />
              پیشاندانی هاوپێچ (PDF) — {document.document_number}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 min-h-0 relative bg-muted/30">
            {previewStatus === "checking" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground" style={ku}>
                <Loader2 className="h-6 w-6 animate-spin" />
                <p className="text-sm">هاوپێچ بارگیری دەکرێت...</p>
              </div>
            )}

            {previewStatus === "error" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center" style={ku}>
                <AlertTriangle className="h-8 w-8 text-amber-500" />
                <p className="text-sm text-muted-foreground">
                  نەتوانرا هاوپێچەکە لەناو لاپەڕەدا پیشان بدرێت. تکایە داگرتنی هاوپێچ تاقی بکەوە.
                </p>
                {fileUrl && (
                  <a
                    href={fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2.5 px-5 text-sm transition-colors"
                  >
                    <Download className="h-4 w-4" />
                    داگرتنی هاوپێچ
                  </a>
                )}
              </div>
            )}

            {previewStatus === "ok" && fileUrl && (
              <iframe
                src={fileUrl}
                title="پیشاندانی هاوپێچ (PDF)"
                className="absolute inset-0 w-full h-full border-0"
                onError={() => setPreviewStatus("error")}
              />
            )}
          </div>

          <div className="flex items-center justify-end gap-2 p-3 border-t bg-background">
            {fileUrl && (
              <a
                href={fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-md border py-2 px-4 text-sm hover:bg-muted transition-colors"
              >
                <Download className="h-4 w-4" />
                داگرتن
              </a>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Replace attachment modal */}
      <Dialog
        open={replaceOpen}
        onOpenChange={(open) => {
          setReplaceOpen(open);
          if (!open) setNewAttachment(null);
        }}
      >
        <DialogContent className="max-w-md" style={ku}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base" style={ku}>
              <RefreshCw className="h-4 w-4 text-muted-foreground" />
              نوێکردنەوەی هاوپێچ
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              هاوپێچی PDF ی نوێ هەڵبژێرە بۆ ئەوەی جێگای هاوپێچی ئێستای نووسراوەکە بگرێتەوە. ئەم کردارە تۆمار دەکرێت لە مێژووی جووڵەی نووسراودا.
            </p>

            <label
              htmlFor="replace-attachment-input"
              className="flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-muted-foreground/30 py-8 px-4 text-center cursor-pointer hover:bg-muted/50 transition-colors"
            >
              <Upload className="h-6 w-6 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {newAttachment ? newAttachment.name : "کلیک بکە بۆ هەڵبژاردنی فایلی PDF"}
              </span>
              <input
                id="replace-attachment-input"
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => setNewAttachment(e.target.files?.[0] ?? null)}
              />
            </label>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setReplaceOpen(false)}
                disabled={replaceAttachmentMutation.isPending}
              >
                هەڵوەشاندنەوە
              </Button>
              <Button
                onClick={replaceAttachment}
                disabled={!newAttachment || replaceAttachmentMutation.isPending}
                className="flex items-center gap-2"
              >
                {replaceAttachmentMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                نوێکردنەوە
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
