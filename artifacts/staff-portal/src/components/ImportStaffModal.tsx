import { useRef, useState } from "react";
import { Upload, Download, X, CheckCircle, AlertCircle, FileSpreadsheet } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const ku: React.CSSProperties = { fontFamily: "'Noto Kufi Arabic', sans-serif" };

interface Props {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}

interface Result {
  inserted: number;
  skipped: number;
  errors: string[];
}

export function ImportStaffModal({ open, onClose, onImported }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const { toast } = useToast();

  if (!open) return null;

  const handleFile = (f: File) => {
    setFile(f);
    setResult(null);
    setParseErrors([]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const downloadTemplate = () => {
    window.open(`${window.location.origin}/api/users/import/template`, "_blank");
  };

  const doImport = async () => {
    if (!file) return;
    setLoading(true);
    setResult(null);
    setParseErrors([]);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${window.location.origin}/api/users/import`, {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      const body = await res.json();
      if (!res.ok) {
        if (body.errors) { setParseErrors(body.errors); }
        else { toast({ title: "هەڵە", description: body.error, variant: "destructive" }); }
      } else {
        setResult(body);
        if (body.inserted > 0) onImported();
      }
    } catch {
      toast({ title: "هەڵەی تەکنیکی", description: "تکایە دووبارە هەوڵ بدەرەوە", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const reset = () => { setFile(null); setResult(null); setParseErrors([]); };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" dir="rtl" style={ku}>
      <div className="w-full max-w-lg mx-4 rounded-2xl shadow-2xl overflow-hidden" style={{ background: "#1e293b", border: "1px solid rgba(255,255,255,0.08)" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-bold text-white">هاوردەکردنی فەرمانبەران لە ئیکسڵەوە</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">

          {/* Template download */}
          <div className="flex items-center justify-between rounded-xl px-4 py-3" style={{ background: "rgba(16,185,129,0.07)", border: "1px solid rgba(16,185,129,0.2)" }}>
            <div>
              <p className="text-sm font-medium text-emerald-300">نموونەی ئیکسڵ داگرە</p>
              <p className="text-xs text-slate-500 mt-0.5">ستونەکان بە ئەم ترتیبە پرکە</p>
            </div>
            <button onClick={downloadTemplate} className="flex items-center gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg transition-colors">
              <Download className="w-3.5 h-3.5" />
              داگرتن
            </button>
          </div>

          {/* Column guide */}
          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
            <table className="w-full text-xs">
              <thead style={{ background: "rgba(255,255,255,0.04)" }}>
                <tr>
                  {["ناوی تەواو*", "ناوی بەکارهێنەر*", "ئیمەیڵ*", "ووشەی نهێنی", "هۆبە"].map(h => (
                    <th key={h} className="px-3 py-2 text-right text-slate-400 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-white/5">
                  <td className="px-3 py-2 text-slate-300">ئاوات ئەحمەد</td>
                  <td className="px-3 py-2 text-slate-300">awat.ahmad</td>
                  <td className="px-3 py-2 text-slate-300">awat@…</td>
                  <td className="px-3 py-2 text-slate-500 italic">ئەختیاری</td>
                  <td className="px-3 py-2 text-slate-500 italic">ئەختیاری</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-500">* ئەگەر ووشەی نهێنی بەتاڵ بێت، ناوی بەکارهێنەر وەک ووشەی نهێنی دەخرێتە بار.</p>

          {/* Drop zone */}
          {!result && (
            <div
              onDrop={handleDrop}
              onDragOver={e => e.preventDefault()}
              onClick={() => inputRef.current?.click()}
              className="rounded-xl p-6 text-center cursor-pointer transition-colors"
              style={{ border: `2px dashed ${file ? "rgba(99,102,241,0.6)" : "rgba(255,255,255,0.1)"}`, background: file ? "rgba(99,102,241,0.05)" : "rgba(255,255,255,0.02)" }}
            >
              <Upload className="w-7 h-7 mx-auto mb-2 text-slate-500" />
              {file ? (
                <p className="text-sm font-medium text-indigo-300">{file.name}</p>
              ) : (
                <>
                  <p className="text-sm text-slate-400">فایلی ئیکسڵ بکشێنە ئێرە یان کلیک بکە</p>
                  <p className="text-xs text-slate-600 mt-1">.xlsx · .xls</p>
                </>
              )}
              <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
            </div>
          )}

          {/* Parse errors */}
          {parseErrors.length > 0 && (
            <div className="rounded-xl p-4 space-y-1" style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.2)" }}>
              <p className="text-sm font-semibold text-red-400 flex items-center gap-1.5"><AlertCircle className="w-4 h-4" /> هەڵەی داتا</p>
              {parseErrors.map((e, i) => <p key={i} className="text-xs text-red-300/80">{e}</p>)}
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="rounded-xl p-4 space-y-2" style={{ background: "rgba(16,185,129,0.07)", border: "1px solid rgba(16,185,129,0.2)" }}>
              <p className="text-sm font-semibold text-emerald-400 flex items-center gap-1.5"><CheckCircle className="w-4 h-4" /> ئیمپۆرت تەواوبوو</p>
              <div className="flex gap-4 text-xs">
                <span className="text-emerald-300">✓ زیادکراو: <strong>{result.inserted}</strong></span>
                {result.skipped > 0 && <span className="text-amber-400">↷ تکراری: <strong>{result.skipped}</strong></span>}
              </div>
              {result.errors.length > 0 && (
                <div className="mt-2 space-y-0.5">
                  {result.errors.map((e, i) => <p key={i} className="text-xs text-amber-300/70">{e}</p>)}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/5">
          {result ? (
            <button onClick={reset} className="text-sm text-slate-400 hover:text-white transition-colors">دووبارە ئیمپۆرت بکە</button>
          ) : (
            <button onClick={onClose} className="text-sm text-slate-400 hover:text-white transition-colors">داخستن</button>
          )}
          {!result && (
            <button
              onClick={doImport}
              disabled={!file || loading}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-semibold px-5 py-2 rounded-xl transition-colors"
            >
              {loading ? "ئیمپۆرت دەکرێت..." : (<><Upload className="w-4 h-4" />ئیمپۆرت</>)}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
