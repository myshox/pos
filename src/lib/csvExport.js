/** 產生 UTF-8 BOM + CSV 字串，供 Excel 正確開啟中文 */
export function buildCSV(rows) {
  const BOM = '\uFEFF';
  const lines = rows.map((row) =>
    row.map((cell) => {
      const s = cell == null ? '' : String(cell);
      if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    }).join(',')
  );
  return BOM + lines.join('\r\n');
}

export function downloadCSV(filename, rows) {
  const csv = buildCSV(rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
