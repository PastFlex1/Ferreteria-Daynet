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

export interface KardexExcelExportParams {
  filename: string;
  sheetName: string;
  title: string;
  storeName: string;
  taxId?: string;
  selectedProduct: {
    name: string;
    sku: string;
    category: string;
    unit: string;
    stock: number;
    costPrice: number;
    price: number;
  } | null;
  movements: {
    date: string;
    typeLabel: string;
    docNumber: string;
    productName?: string;
    sku?: string;
    warehouse?: string;
    entityName: string;
    user: string;
    inQty: number;
    inCost: number;
    inTotal: number;
    outQty: number;
    outCost: number;
    outTotal: number;
    balanceQty: number;
    balanceCost: number;
    balanceTotal: number;
  }[];
}

export function exportKardexToModernExcel({
  filename,
  sheetName,
  title,
  storeName,
  taxId,
  selectedProduct,
  movements,
}: KardexExcelExportParams) {
  const wb = XLSX.utils.book_new();
  const isSingle = !!selectedProduct;

  // 1. Meta Information Block (Rows 0 to 2)
  const metaMatrix: any[][] = [
    [title],
    [
      `Empresa: ${storeName || 'Ferretería Industrial'}`,
      taxId ? `RUC: ${taxId}` : '',
      isSingle ? `SKU: ${selectedProduct.sku}` : `Modo: Consolidado General`,
      isSingle ? `Artículo: ${selectedProduct.name}` : `Total Registros: ${movements.length}`,
    ],
    [
      `Emisión: ${new Date().toLocaleString('es-EC')}`,
      isSingle ? `Categoría: ${selectedProduct.category}` : '',
      isSingle ? `Stock Actual: ${selectedProduct.stock} ${selectedProduct.unit}` : '',
      isSingle ? `Costo Promedio: $${selectedProduct.costPrice.toFixed(2)}` : '',
    ],
    [], // Row 3 empty separator
  ];

  // 2. Column Structure & Headers
  // Group Header (Row 4)
  const groupHeaderRow = isSingle
    ? [
        'DATOS DE LA TRANSACCIÓN', '', '', '', '',
        'ENTRADAS (+)', '', '',
        'SALIDAS (-)', '', '',
        'EXISTENCIAS & SALDOS', '', ''
      ]
    : [
        'DATOS DE LA TRANSACCIÓN', '', '', '', '', '', '',
        'ENTRADAS (+)', '', '',
        'SALIDAS (-)', '', '',
        'SALDOS ACTUALES', ''
      ];

  // Detail Subheader (Row 5)
  const subHeaderRow = isSingle
    ? [
        'Fecha & Hora',
        'Tipo Movimiento',
        'N° Comprobante',
        'Bodega / Sucursal',
        'Detalle / Cliente / Prov.',
        'Cantidad',
        'Costo Unit. ($)',
        'Total ($)',
        'Cantidad',
        'Costo Unit. ($)',
        'Total ($)',
        'Existencia',
        'Costo Prom. ($)',
        'Valor Total ($)',
      ]
    : [
        'Fecha & Hora',
        'Tipo Movimiento',
        'N° Comprobante',
        'Producto',
        'SKU',
        'Bodega / Sucursal',
        'Detalle / Cliente / Prov.',
        'Cantidad',
        'Costo Unit. ($)',
        'Total ($)',
        'Cantidad',
        'Costo Unit. ($)',
        'Total ($)',
        'Stock Actual',
        'Costo Unit. ($)',
      ];

  // 3. Data Rows Matrix
  let totalInQty = 0;
  let totalInTotal = 0;
  let totalOutQty = 0;
  let totalOutTotal = 0;

  const dataMatrix = movements.map((m) => {
    totalInQty += m.inQty || 0;
    totalInTotal += m.inTotal || 0;
    totalOutQty += m.outQty || 0;
    totalOutTotal += m.outTotal || 0;

    if (isSingle) {
      return [
        m.date,
        m.typeLabel,
        m.docNumber || '-',
        m.warehouse || 'Bodega Central',
        `${m.entityName} (${m.user})`,
        m.inQty > 0 ? m.inQty : null,
        m.inQty > 0 ? m.inCost : null,
        m.inQty > 0 ? m.inTotal : null,
        m.outQty > 0 ? m.outQty : null,
        m.outQty > 0 ? m.outCost : null,
        m.outQty > 0 ? m.outTotal : null,
        m.balanceQty,
        m.balanceCost,
        m.balanceTotal,
      ];
    } else {
      return [
        m.date,
        m.typeLabel,
        m.docNumber || '-',
        m.productName || 'Producto General',
        m.sku || 'N/A',
        m.warehouse || 'Bodega Central',
        `${m.entityName} (${m.user})`,
        m.inQty > 0 ? m.inQty : null,
        m.inQty > 0 ? m.inCost : null,
        m.inQty > 0 ? m.inTotal : null,
        m.outQty > 0 ? m.outQty : null,
        m.outQty > 0 ? m.outCost : null,
        m.outQty > 0 ? m.outTotal : null,
        m.balanceQty,
        m.balanceCost,
      ];
    }
  });

  // 4. Totals Summary Row
  const lastRow = movements[movements.length - 1];
  const summaryRow = isSingle
    ? [
        'TOTALES Y SALDO FINAL',
        '',
        '',
        '',
        '',
        totalInQty,
        null,
        totalInTotal,
        totalOutQty,
        null,
        totalOutTotal,
        lastRow ? lastRow.balanceQty : 0,
        lastRow ? lastRow.balanceCost : 0,
        lastRow ? lastRow.balanceTotal : 0,
      ]
    : [
        'TOTALES GENERALES',
        '',
        '',
        '',
        '',
        '',
        '',
        totalInQty,
        null,
        totalInTotal,
        totalOutQty,
        null,
        totalOutTotal,
        null,
        null,
      ];

  const fullDataMatrix = [
    ...metaMatrix,
    groupHeaderRow,
    subHeaderRow,
    ...dataMatrix,
    summaryRow,
  ];

  const ws = XLSX.utils.aoa_to_sheet(fullDataMatrix);

  // Initialize merges if needed
  if (!ws['!merges']) ws['!merges'] = [];
  const totalCols = subHeaderRow.length;

  // Merge Title across all columns
  ws['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: totalCols - 1 } });

  // Style Title Row (A1)
  ws['A1'].s = {
    font: { name: 'Arial', sz: 14, bold: true, color: { rgb: 'FFFFFF' } },
    fill: { fgColor: { rgb: '0F172A' } }, // Slate 900
    alignment: { horizontal: 'center', vertical: 'center' },
  };

  // Style Meta Rows (Row 1 & 2)
  for (let r = 1; r <= 2; r++) {
    for (let c = 0; c < totalCols; c++) {
      const ref = XLSX.utils.encode_cell({ r, c });
      if (ws[ref]) {
        ws[ref].s = {
          font: { name: 'Arial', sz: 9, bold: true, color: { rgb: '475569' } },
          fill: { fgColor: { rgb: 'F1F5F9' } },
          alignment: { horizontal: 'left', vertical: 'center' },
        };
      }
    }
  }

  // Merges for Group Header (Row 4)
  if (isSingle) {
    ws['!merges'].push({ s: { r: 4, c: 0 }, e: { r: 4, c: 4 } }); // Datos Transacción
    ws['!merges'].push({ s: { r: 4, c: 5 }, e: { r: 4, c: 7 } }); // Entradas
    ws['!merges'].push({ s: { r: 4, c: 8 }, e: { r: 4, c: 10 } }); // Salidas
    ws['!merges'].push({ s: { r: 4, c: 11 }, e: { r: 4, c: 13 } }); // Saldos
  } else {
    ws['!merges'].push({ s: { r: 4, c: 0 }, e: { r: 4, c: 6 } }); // Datos Transacción
    ws['!merges'].push({ s: { r: 4, c: 7 }, e: { r: 4, c: 9 } }); // Entradas
    ws['!merges'].push({ s: { r: 4, c: 10 }, e: { r: 4, c: 12 } }); // Salidas
    ws['!merges'].push({ s: { r: 4, c: 13 }, e: { r: 4, c: 14 } }); // Saldos
  }

  // Style Group Header (Row 4)
  const groupRowIdx = 4;
  for (let c = 0; c < totalCols; c++) {
    const ref = XLSX.utils.encode_cell({ r: groupRowIdx, c });
    if (!ws[ref]) ws[ref] = { v: '', t: 's' };

    let bgColor = '0F172A'; // Slate-950 for transaction
    const inColStart = isSingle ? 5 : 7;
    const outColStart = isSingle ? 8 : 10;
    const balColStart = isSingle ? 11 : 13;

    if (c >= inColStart && c < outColStart) bgColor = '065F46'; // Emerald-800
    else if (c >= outColStart && c < balColStart) bgColor = '9F1239'; // Rose-800
    else if (c >= balColStart) bgColor = '92400E'; // Amber-800

    ws[ref].s = {
      font: { name: 'Arial', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
      fill: { fgColor: { rgb: bgColor } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: {
        top: { style: 'thin', color: { rgb: 'CBD5E1' } },
        bottom: { style: 'thin', color: { rgb: 'CBD5E1' } },
        left: { style: 'thin', color: { rgb: 'CBD5E1' } },
        right: { style: 'thin', color: { rgb: 'CBD5E1' } },
      },
    };
  }

  // Style Subheader Row (Row 5)
  const subRowIdx = 5;
  for (let c = 0; c < totalCols; c++) {
    const ref = XLSX.utils.encode_cell({ r: subRowIdx, c });
    if (!ws[ref]) continue;

    let bgColor = '334155'; // Slate-700
    const inColStart = isSingle ? 5 : 7;
    const outColStart = isSingle ? 8 : 10;
    const balColStart = isSingle ? 11 : 13;

    if (c >= inColStart && c < outColStart) bgColor = '047857'; // Emerald-700
    else if (c >= outColStart && c < balColStart) bgColor = 'BE123C'; // Rose-700
    else if (c >= balColStart) bgColor = 'D97706'; // Amber-600

    ws[ref].s = {
      font: { name: 'Arial', sz: 10, bold: true, color: { rgb: 'FFFFFF' } },
      fill: { fgColor: { rgb: bgColor } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: {
        top: { style: 'thin', color: { rgb: 'CBD5E1' } },
        bottom: { style: 'medium', color: { rgb: '0F172A' } },
        left: { style: 'thin', color: { rgb: 'CBD5E1' } },
        right: { style: 'thin', color: { rgb: 'CBD5E1' } },
      },
    };
  }

  // Style Data Rows (Row 6 to Row 6 + dataMatrix.length - 1)
  const startDataRow = 6;
  for (let r = 0; r < dataMatrix.length; r++) {
    const rowIdx = startDataRow + r;
    const isEven = r % 2 === 0;

    for (let c = 0; c < totalCols; c++) {
      const ref = XLSX.utils.encode_cell({ r: rowIdx, c });
      if (!ws[ref]) ws[ref] = { v: '', t: 's' };

      const inColStart = isSingle ? 5 : 7;
      const outColStart = isSingle ? 8 : 10;
      const balColStart = isSingle ? 11 : 13;

      let bgColor = isEven ? 'FFFFFF' : 'F8FAFC';
      if (c >= inColStart && c < outColStart) bgColor = isEven ? 'F0FDF4' : 'ECFDF5';
      else if (c >= outColStart && c < balColStart) bgColor = isEven ? 'FFF5F5' : 'FFF1F2';
      else if (c >= balColStart) bgColor = isEven ? 'FFFBEB' : 'FEF3C7';

      // Alignment & format
      const val = ws[ref].v;
      const isNumeric = typeof val === 'number';

      let align = 'left';
      if (c === 0 || c === 1 || c === 2) align = 'center'; // Date, Type, Doc
      else if (isNumeric) align = 'right';

      ws[ref].s = {
        font: { name: 'Arial', sz: 9, color: { rgb: '1E293B' } },
        fill: { fgColor: { rgb: bgColor } },
        alignment: { horizontal: align, vertical: 'center' },
        border: {
          top: { style: 'thin', color: { rgb: 'E2E8F0' } },
          bottom: { style: 'thin', color: { rgb: 'E2E8F0' } },
          left: { style: 'thin', color: { rgb: 'E2E8F0' } },
          right: { style: 'thin', color: { rgb: 'E2E8F0' } },
        },
      };

      // Apply Excel Number Format
      if (isNumeric) {
        const isMoneyCol =
          (isSingle && (c === 6 || c === 7 || c === 9 || c === 10 || c === 12 || c === 13)) ||
          (!isSingle && (c === 8 || c === 9 || c === 11 || c === 12 || c === 14));

        if (isMoneyCol) {
          ws[ref].z = '"$"#,##0.00';
        } else {
          ws[ref].z = '#,##0.00';
        }
      }
    }
  }

  // Style Totals Summary Row (Last Row)
  const totalsRowIdx = startDataRow + dataMatrix.length;

  // Merge Summary Label
  const labelEndCol = isSingle ? 4 : 6;
  ws['!merges'].push({ s: { r: totalsRowIdx, c: 0 }, e: { r: totalsRowIdx, c: labelEndCol } });

  for (let c = 0; c < totalCols; c++) {
    const ref = XLSX.utils.encode_cell({ r: totalsRowIdx, c });
    if (!ws[ref]) ws[ref] = { v: '', t: 's' };

    const val = ws[ref].v;
    const isNumeric = typeof val === 'number';

    ws[ref].s = {
      font: { name: 'Arial', sz: 10, bold: true, color: { rgb: 'FFFFFF' } },
      fill: { fgColor: { rgb: '0F172A' } }, // Dark Slate 950
      alignment: { horizontal: c <= labelEndCol ? 'center' : 'right', vertical: 'center' },
      border: {
        top: { style: 'medium', color: { rgb: 'EA580C' } },
        bottom: { style: 'double', color: { rgb: 'FFFFFF' } },
        left: { style: 'thin', color: { rgb: '334155' } },
        right: { style: 'thin', color: { rgb: '334155' } },
      },
    };

    if (isNumeric) {
      const isMoneyCol =
        (isSingle && (c === 7 || c === 10 || c === 12 || c === 13)) ||
        (!isSingle && (c === 9 || c === 12));

      if (isMoneyCol) {
        ws[ref].z = '"$"#,##0.00';
      } else {
        ws[ref].z = '#,##0.00';
      }
    }
  }

  // 5. Column Widths
  ws['!cols'] = isSingle
    ? [
        { wch: 18 }, // Date
        { wch: 22 }, // Type
        { wch: 18 }, // Doc
        { wch: 22 }, // Warehouse
        { wch: 32 }, // Entity/User
        { wch: 14 }, // In Qty
        { wch: 16 }, // In Cost
        { wch: 18 }, // In Total
        { wch: 14 }, // Out Qty
        { wch: 16 }, // Out Cost
        { wch: 18 }, // Out Total
        { wch: 16 }, // Bal Qty
        { wch: 18 }, // Bal Cost
        { wch: 20 }, // Bal Total
      ]
    : [
        { wch: 18 }, // Date
        { wch: 22 }, // Type
        { wch: 18 }, // Doc
        { wch: 30 }, // Product
        { wch: 16 }, // SKU
        { wch: 22 }, // Warehouse
        { wch: 32 }, // Entity/User
        { wch: 14 }, // In Qty
        { wch: 16 }, // In Cost
        { wch: 18 }, // In Total
        { wch: 14 }, // Out Qty
        { wch: 16 }, // Out Cost
        { wch: 18 }, // Out Total
        { wch: 16 }, // Bal Qty
        { wch: 18 }, // Bal Cost
      ];

  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
}
