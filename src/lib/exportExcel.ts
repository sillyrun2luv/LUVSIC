import type { RecordEntry } from "@/types";
import { formatDateTime } from "./date";
import { saveFile } from "./saveFile";

/**
 * 导出记录为可被 Excel / WPS 直接打开的 .xls（HTML Table）文件。
 * 不依赖任何第三方库，体积小兼容性好。
 */
export async function exportRecordsXls(records: RecordEntry[]): Promise<void> {
  const rows: string[] = [];
  // 表头
  rows.push(
    [
      "日期时间",
      "时长(分钟)",
      "刺激形式",
      "辅助道具",
      "备注",
      "记录创建时间",
    ].map(htmlCellEscape).join("</td><td>"),
  );

  for (const r of records) {
    rows.push(
      [
        formatDateTime(r.timestamp),
        r.duration > 0 ? String(r.duration) : "",
        (r.forms ?? []).join("、"),
        (r.tools ?? []).join("、"),
        r.note ?? "",
        formatDateTime(r.createdAt),
      ]
        .map(htmlCellEscape)
        .join("</td><td>"),
    );
  }

  const body = rows.map((r) => `<tr><td>${r}</td></tr>`).join("");

  // Excel 能识别 HTML 为 xls，需要带 <html xmlns:o...> 头才不弹提示
  const html = `
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8" />
<!--[if gte mso 9]>
<xml>
<x:ExcelWorkbook>
<x:ExcelWorksheets><x:ExcelWorksheet><x:Name>记录</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets>
</x:ExcelWorkbook>
</xml>
<![endif]-->
<style>
td { border: 1px solid #ccc; font-family: "Microsoft YaHei", sans-serif; padding: 4px 8px; }
tr:nth-child(1) td { background:#F5E6CE; font-weight:bold; }
</style>
</head>
<body>
<table border="1">${body}</table>
</body>
</html>`.trim();

  // BOM 让 Excel 正确识别 UTF-8
  const content = "\uFEFF" + html;
  const date = new Date().toISOString().slice(0, 10);
  await saveFile({
    filename: `自卫吧-记录-${date}.xls`,
    content,
    mimeType: "application/vnd.ms-excel;charset=utf-8",
  });
}

function htmlCellEscape(s: string | number): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
