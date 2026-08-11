import { useRef } from "react";
import { Download, Upload, Trash2 } from "lucide-react";
import { useRecordStore } from "@/store/useRecordStore";
import { toast } from "@/store/useToastStore";
import type { RecordEntry } from "@/types";

interface BackupBarProps {
  onClearAll: () => void;
}

export default function BackupBar({ onClearAll }: BackupBarProps) {
  const records = useRecordStore((s) => s.records);
  const importData = useRecordStore((s) => s.importData);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    if (records.length === 0) {
      toast("暂无记录可导出", "warn");
      return;
    }
    const blob = new Blob([JSON.stringify(records, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const date = new Date().toISOString().slice(0, 10);
    a.download = `zwba-backup-${date}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast("已导出备份", "success");
  };

  const handleImport = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!Array.isArray(parsed)) throw new Error("格式不对");
        importData(parsed as RecordEntry[]);
        toast(`已导入 ${parsed.length} 条记录`, "success");
      } catch {
        toast("文件格式不正确", "warn");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={handleExport}
        className="flex items-center gap-2 rounded-full border border-line px-4 py-2 text-sm text-mist transition-colors hover:border-amber/40 hover:text-amber-glow"
      >
        <Download size={15} />
        导出备份
      </button>
      <button
        onClick={() => fileRef.current?.click()}
        className="flex items-center gap-2 rounded-full border border-line px-4 py-2 text-sm text-mist transition-colors hover:border-amber/40 hover:text-amber-glow"
      >
        <Upload size={15} />
        导入
      </button>
      <button
        onClick={onClearAll}
        className="flex items-center gap-2 rounded-full border border-red-500/30 px-4 py-2 text-sm text-red-300/80 transition-colors hover:border-red-400/60 hover:text-red-200"
      >
        <Trash2 size={15} />
        清空
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleImport(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
