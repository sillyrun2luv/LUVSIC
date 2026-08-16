import { useEffect, useState } from "react";
import { useUIStore } from "@/store/useUIStore";
import { useRecordStore } from "@/store/useRecordStore";
import { toast } from "@/store/useToastStore";
import { t } from "@/store/useI18nStore";
import RecordDetailSheet from "@/components/RecordDetailSheet";
import ConfirmDialog from "@/components/ConfirmDialog";
import type { RecordEntry } from "@/types";

/**
 * 全局记录详情 Provider：
 * - 读取 detailRecordId 显示详情弹窗
 * - 详情里的"编辑"跳到记录页编辑
 * - 详情里的"删除"先确认，确认后删除并弹 5 秒撤销
 */
export default function RecordDetailProvider() {
  const detailId = useUIStore((s) => s.detailRecordId);
  const closeDetail = useUIStore((s) => s.closeDetail);
  const goRecord = useUIStore((s) => s.goRecord);

  const records = useRecordStore((s) => s.records);
  const deleteRecord = useRecordStore((s) => s.deleteRecord);
  const restoreRecord = useRecordStore((s) => s.restoreRecord);

  const [confirmOpen, setConfirmOpen] = useState(false);

  const record: RecordEntry | null = detailId
    ? records.find((r) => r.id === detailId) ?? null
    : null;

  // 若记录已被删除/不存在，自动关闭详情
  useEffect(() => {
    if (detailId && !record) closeDetail();
  }, [detailId, record, closeDetail]);

  const handleEdit = () => {
    if (detailId) goRecord(detailId);
    closeDetail();
  };

  const handleAskDelete = () => {
    setConfirmOpen(true);
  };

  const handleConfirmDelete = () => {
    if (!record) {
      setConfirmOpen(false);
      return;
    }
    const snapshot: RecordEntry = { ...record };
    deleteRecord(snapshot.id);
    setConfirmOpen(false);
    closeDetail();
    toast(t("recordDetail.deleted"), "warn", {
      label: t("common.undo"),
      onAction: () => {
        restoreRecord(snapshot);
        toast(t("recordDetail.restored"), "success");
      },
    });
  };

  return (
    <>
      <RecordDetailSheet
        record={record}
        onClose={closeDetail}
        onEdit={handleEdit}
        onDelete={handleAskDelete}
      />
      <ConfirmDialog
        open={confirmOpen}
        danger
        title={t("recordDetail.deleteTitle")}
        message={t("recordDetail.deleteMessage")}
        confirmText={t("recordDetail.confirmDelete")}
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}
