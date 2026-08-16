import { useRef } from "react";
import { Download, Upload, Trash2 } from "lucide-react";
import { useRecordStore } from "@/store/useRecordStore";
import { toast } from "@/store/useToastStore";
import { saveFile } from "@/lib/saveFile";
import type { RecordEntry } from "@/types";
import { t } from "@/store/useI18nStore";

interface BackupBarProps {
  onClearAll: () => void;
}

export default function BackupBar({ onClearAll }: BackupBarProps) {
  const records = useRecordStore((s) => s.records);
  const importData = useRecordStore((s) => s.importData);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    if (records.length === 0) {
      toast(t("settings.dataExport.noRecordsToExport"), "warn");
      return;
    }
    const date = new Date().toISOString().slice(0, 10);
    try {
      await saveFile({
        filename: `zwba-backup-${date}.json`,
        content: JSON.stringify(records, null, 2),
        mimeType: "application/json",
      });
      toast(t("settings.dataExport.exportSuccess"), "success");
    } catch (err) {
      console.error(err);
      toast(t("settings.dataExport.exportFailed"), "warn");
    }
  };

  const handleImport = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!Array.isArray(parsed)) throw new Error("格式不对");
        importData(parsed as RecordEntry[]);
        toast(t("settings.dataExport.importSuccess", parsed.length), "success");
      } catch {
        toast(t("settings.dataExport.invalidFileFormat"), "warn");
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
        {t("settings.dataExport.exportBackup")}
      </button>
      <button
        onClick={() => fileRef.current?.click()}
        className="flex items-center gap-2 rounded-full border border-line px-4 py-2 text-sm text-mist transition-colors hover:border-amber/40 hover:text-amber-glow"
      >
        <Upload size={15} />
        {t("settings.dataExport.import")}
      </button>
      <button
        onClick={onClearAll}
        className="flex items-center gap-2 rounded-full border border-red-500/30 px-4 py-2 text-sm text-red-300/80 transition-colors hover:border-red-400/60 hover:text-red-200"
      >
        <Trash2 size={15} />
        {t("settings.dataExport.clear")}
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
