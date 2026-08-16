import { useEffect } from "react";
import { Clock, Pencil, Trash2, X, Calendar } from "lucide-react";
import type { RecordEntry } from "@/types";
import { formatDuration, formatDateCN, formatTime } from "@/lib/date";
import { t } from "@/store/useI18nStore";

interface RecordDetailSheetProps {
  record: RecordEntry | null;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export default function RecordDetailSheet({
  record,
  onClose,
  onEdit,
  onDelete,
}: RecordDetailSheetProps) {
  useEffect(() => {
    if (!record) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [record, onClose]);

  if (!record) return null;

  const hasForms = record.forms && record.forms.length > 0;
  const hasTools = record.tools && record.tools.length > 0;
  const totalSec = Math.round(record.duration * 60);

  return (
    <div className="fixed inset-0 z-50 pb-[72px] flex items-end justify-center">
      <div
        className="absolute inset-0 animate-fadeIn bg-ink-950/70 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="surface relative z-10 w-full max-w-lg animate-slideUp p-5 pb-6">
        {/* 头部 */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar size={20} className="text-amber" />
            <h3 className="font-display text-lg text-cream">{t('recordDetail.title')}</h3>
          </div>
          <button onClick={onClose} className="text-muted hover:text-mist" aria-label={t('recordDetail.close')}>
            <X size={18} />
          </button>
        </div>

        {/* 时间 */}
        <div className="mb-3 flex items-center gap-2 text-sm text-mist">
          <Clock size={14} className="text-muted" />
          <span>{formatDateCN(record.timestamp)}</span>
          <span className="text-muted">·</span>
          <span className="font-mono text-amber-glow">{formatTime(record.timestamp)}</span>
        </div>

        {/* 时长 */}
        <div className="mb-4 flex items-center justify-center gap-2 rounded-xl border border-line bg-ink-900/60 py-4">
          <span className="stat-number text-3xl text-amber-glow tabular-nums">
            {formatDuration(record.duration)}
          </span>
          <span className="text-xs text-muted">{t('recordDetail.secondUnit', totalSec)}</span>
        </div>

        {/* 形式 */}
        {hasForms && (
          <div className="mb-3">
            <span className="label-eyebrow">{t('recordDetail.forms')}</span>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {record.forms.map((f) => (
                <span
                  key={`f-${f}`}
                  className="rounded-full border border-amber/30 bg-amber/10 px-2.5 py-0.5 text-xs text-amber-glow"
                >
                  {f}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 道具 */}
        {hasTools && (
          <div className="mb-3">
            <span className="label-eyebrow">{t('recordDetail.tools')}</span>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {record.tools.map((t) => (
                <span
                  key={`t-${t}`}
                  className="rounded-full bg-ink-800 px-2.5 py-0.5 text-xs text-mist"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 备注 */}
        {record.note ? (
          <div className="mb-5">
            <span className="label-eyebrow">{t('recordDetail.noteTitle')}</span>
            <p className="mt-1.5 rounded-xl border border-line bg-ink-900/40 px-3 py-2.5 text-sm leading-relaxed text-cream italic">
              {t('recordDetail.noteFormat', record.note)}
            </p>
          </div>
        ) : (
          <p className="mb-5 text-xs text-muted/70">{t('recordDetail.noNote')}</p>
        )}

        {/* 操作按钮 */}
        <div className="flex items-center gap-3">
          <button
            onClick={onDelete}
            className="flex items-center justify-center gap-1.5 rounded-full border border-red-400/40 bg-red-500/10 px-4 py-2.5 text-sm text-red-300 transition-colors hover:bg-red-500/20"
          >
            <Trash2 size={15} />
            {t('recordDetail.delete')}
          </button>
          <button
            onClick={onEdit}
            className="flex flex-1 items-center justify-center gap-2 rounded-full bg-amber py-2.5 font-medium text-ink-950 shadow-glow transition-all hover:bg-amber-glow"
          >
            <Pencil size={15} />
            {t('recordDetail.edit')}
          </button>
        </div>
      </div>
    </div>
  );
}
