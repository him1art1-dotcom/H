
// Service to handle File Imports and Exports
// Depends on global libraries: XLSX (SheetJS) included in index.html

export interface ExportColumn {
    header: string;
    key: string;
}

export const FileService = {
    /**
     * Parse Excel or CSV File
     */
    parseImportFile: async (file: File): Promise<any[]> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const data = e.target?.result;
                    const workbook = (window as any).XLSX.read(data, { type: 'binary' });
                    const sheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[sheetName];
                    const json = (window as any).XLSX.utils.sheet_to_json(worksheet);
                    resolve(json);
                } catch (error) {
                    reject(error);
                }
            };
            
            reader.onerror = (error) => reject(error);
            reader.readAsBinaryString(file);
        });
    },

    /**
     * Export Data to Excel (XLSX)
     */
    exportToExcel: (data: any[], filename: string) => {
        const ws = (window as any).XLSX.utils.json_to_sheet(data);
        const wb = (window as any).XLSX.utils.book_new();
        (window as any).XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
        (window as any).XLSX.writeFile(wb, `${filename}.xlsx`);
    },

    /**
     * Export Data to CSV
     */
    exportToCSV: (data: any[], filename: string) => {
        const ws = (window as any).XLSX.utils.json_to_sheet(data);
        const csv = (window as any).XLSX.utils.sheet_to_csv(ws);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `${filename}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    },

    /**
     * Export Data to HTML (and Print/PDF helper)
     */
    exportToHTML: (columns: ExportColumn[], data: any[], filename: string, title: string, autoPrint: boolean = false) => {
        const htmlContent = `
        <html dir="rtl">
        <head>
            <meta charset="UTF-8">
            <title>${title}</title>
            <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; direction: rtl; background: white; color: black; }
                h1 { text-align: center; color: #333; margin-bottom: 10px; }
                .meta { text-align: center; color: #666; margin-bottom: 30px; font-size: 0.9em; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; border: 1px solid #ddd; }
                th, td { border: 1px solid #ddd; padding: 12px 15px; text-align: right; }
                th { background-color: #f8f9fa; font-weight: bold; color: #333; }
                tr:nth-child(even) { background-color: #f9f9f9; }
                @media print {
                    @page { margin: 2cm; }
                    body { -webkit-print-color-adjust: exact; }
                    th { background-color: #eee !important; }
                }
            </style>
        </head>
        <body>
            <h1>${title}</h1>
            <div class="meta">تم استخراج التقرير بتاريخ: ${new Date().toLocaleDateString('ar-SA')}</div>
            <table>
                <thead>
                    <tr>${columns.map(c => `<th>${c.header}</th>`).join('')}</tr>
                </thead>
                <tbody>
                    ${data.map(row => `<tr>${columns.map(c => `<td>${row[c.key] || '-'}</td>`).join('')}</tr>`).join('')}
                </tbody>
            </table>
            <script>
                ${autoPrint ? 'window.onload = function() { window.print(); }' : ''}
            </script>
        </body>
        </html>`;

        if (autoPrint) {
            const printWindow = window.open('', '_blank');
            if (printWindow) {
                printWindow.document.write(htmlContent);
                printWindow.document.close();
            } else {
                alert('يرجى السماح بالنوافذ المنبثقة للطباعة');
            }
        } else {
            const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
            const link = document.createElement("a");
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", `${filename}.html`);
            link.click();
        }
    },

    /**
     * Export Data to PDF (Via Native Print)
     * Using native browser print ensures 100% Arabic support without heavy font files.
     */
    exportToPDF: (columns: ExportColumn[], data: any[], filename: string, title: string) => {
        // We leverage the HTML export with auto-print enabled.
        // Modern browsers allow "Save as PDF" from the print dialog, which renders Arabic perfectly.
        FileService.exportToHTML(columns, data, filename, title, true);
    }
};
