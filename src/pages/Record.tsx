import { useMemo } from "react";
import RecordForm from "@/components/RecordForm";
import { useRecordStore } from "@/store/useRecordStore";
import { useUIStore } from "@/store/useUIStore";
import type { RecordEntry } from "@/types";

export default function Record() {
  const records = useRecordStore((s) => s.records);
  const editingId = useUIStore((s) => s.editingId);
  const goRecord = useUIStore((s) => s.goRecord);
  const setView = useUIStore((s) => s.setView);

  const editing: RecordEntry | null = useMemo(
    () => (editingId ? records.find((r) => r.id === editingId) ?? null : null),
    [editingId, records],
  );

  return (
    <div className="animate-fadeIn space-y-8">
      <header>
        <p className="label-eyebrow mb-2">{editing ? "编辑" : "记录"}</p>
        <h1 className="font-display text-4xl font-medium text-cream">
          {editing ? (
            <>
              修改<em className="not-italic text-amber-glow">这一笔</em>
            </>
          ) : (
            <>
              写下<em className="not-italic text-amber-glow">这一笔</em>
            </>
          )}
        </h1>
      </header>

      <RecordForm
        editing={editing}
        onDone={() => setView("overview")}
        onCancel={() => {
          if (editing) {
            goRecord(null);
          } else {
            setView("overview");
          }
        }}
      />
    </div>
  );
}
