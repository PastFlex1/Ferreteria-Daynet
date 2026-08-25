import * as XLSX from 'xlsx-js-style';

interface ExcelExportOptions {
  filename: string;
  sheetName: string;
  title: string;
  columns: { header: string; key: string; width?: number; format?: string }[];
  data: any[];
}

export function exportToModernExcel({ filename, sheetName, title, columns, data }: ExcelExportOptions) {
  const wb = XLSX.utils.book_new();

  // 1. Create headers
  const headers = columns.map((col) => col.header);
  
  // 2. Prepare data matrix
  const matrix = data.map((item) => {
    return columns.map((col) => {
      let val = item[col.key];
      if (val === null || val === undefined) val = '';
      return val;
    });
  });

  // Combine title, empty row, headers, and data
  const finalData = [
    [title], // Row 1: Title
    [],      // Row 2: Empty
    headers, // Row 3: Headers
    ...matrix, // Row 4+: Data
  ];

  const ws = XLSX.utils.aoa_to_sheet(finalData);

  // Styling the Title
  ws['A1'].s = {
    font: { name: 'Arial', sz: 16, bold: true, color: { rgb: "FFFFFF" } },
    fill: { fgColor: { rgb: "EA580C" } }, // Orange-600
    alignment: { horizontal: "center", vertical: "center" }
  };
  
  // Merge Title across all columns
  if (!ws['!merges']) ws['!merges'] = [];
  ws['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: columns.length - 1 } });

  // Add borders and alignments to Headers
  const headerRowIndex = 2; // 0-based
  for (let c = 0; c < columns.length; c++) {
    const cellRef = XLSX.utils.encode_cell({ r: headerRowIndex, c: c });
    if (!ws[cellRef]) continue;
    ws[cellRef].s = {
      font: { name: 'Arial', sz: 11, bold: true, color: { rgb: "FFFFFF" } },
      fill: { fgColor: { rgb: "1E293B" } }, // Slate-800
      alignment: { horizontal: "center", vertical: "center" },
      border: {
        top: { style: "thin", color: { rgb: "CBD5E1" } },
        bottom: { style: "thin", color: { rgb: "CBD5E1" } },
        left: { style: "thin", color: { rgb: "CBD5E1" } },
        right: { style: "thin", color: { rgb: "CBD5E1" } },
      }
    };
  }

  // Add borders and styling to Data cells
  for (let r = 0; r < matrix.length; r++) {
    const isEven = r % 2 === 0;
    for (let c = 0; c < columns.length; c++) {
      const cellRef = XLSX.utils.encode_cell({ r: r + 3, c: c }); // Data starts at row 3 (0-based)
      if (!ws[cellRef]) ws[cellRef] = { v: '', t: 's' };
      
      const col = columns[c];
      const align = col.format === 'currency' || col.format === 'number' ? 'right' : (col.format === 'center' ? 'center' : 'left');

      ws[cellRef].s = {
        font: { name: 'Arial', sz: 10, color: { rgb: "334155" } }, // Slate-700
        fill: { fgColor: { rgb: isEven ? "F8FAFC" : "FFFFFF" } }, // Alternating rows
        alignment: { horizontal: align, vertical: "center" },
        border: {
          top: { style: "thin", color: { rgb: "E2E8F0" } },
          bottom: { style: "thin", color: { rgb: "E2E8F0" } },
          left: { style: "thin", color: { rgb: "E2E8F0" } },
          right: { style: "thin", color: { rgb: "E2E8F0" } },
        }
      };

      // Apply currency format string if applicable
      if (col.format === 'currency' && typeof ws[cellRef].v === 'number') {
         ws[cellRef].z = '"$"#,##0.00';
      }
    }
  }

  // Set column widths
  ws['!cols'] = columns.map(col => ({ wch: col.width || 15 }));

  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
}
