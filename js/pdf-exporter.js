/* ================================================================
   PDF-EXPORTER.JS — Generación de Reportes PDF con jsPDF y AutoTable
   ================================================================ */

class PdfExporter {
  constructor() {
    this._fmtMoney = (val) => {
      if (!val) return '0,00';
      return Number(val).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    // Bind buttons
    this._btnOpenModal = document.getElementById('btnOpenPdfModal');
    this._btnCloseModal = document.getElementById('btnClosePdfModal');
    this._btnCancelPdf = document.getElementById('btnCancelPdf');
    this._btnGeneratePdf = document.getElementById('btnGeneratePdf');
    this._modal = document.getElementById('pdfExportModal');

    // Checkboxes
    this._chkKpis = document.getElementById('chkPdfKpis');
    this._chkPartidas = document.getElementById('chkPdfPartidas');
    this._chkEstructuras = document.getElementById('chkPdfEstructuras');
    this._chkMatriz = document.getElementById('chkPdfMatriz');
    this._chkGenerica = document.getElementById('chkPdfGenerica');
    this._chkGraficos = document.getElementById('chkPdfGraficos');

    this._initEvents();
  }

  openModal() {
    if (!window.dataManager || window.dataManager.getAllRaw().rows.length === 0) {
      alert("Por favor, cargue un archivo primero.");
      return;
    }
    if (this._modal) {
      this._modal.style.display = 'flex';
    } else {
      console.error("Error: Modal no encontrado. Revise el ID pdfExportModal en HTML.");
      alert("Error interno: No se pudo abrir la ventana de exportación.");
    }
  }

  _initEvents() {
    if (this._btnCloseModal) {
      this._btnCloseModal.addEventListener('click', () => this._modal.style.display = 'none');
    }
    if (this._btnCancelPdf) {
      this._btnCancelPdf.addEventListener('click', () => this._modal.style.display = 'none');
    }

    if (this._btnGeneratePdf) {
      this._btnGeneratePdf.addEventListener('click', async () => {
        // Show loading state
        const originalText = this._btnGeneratePdf.innerText;
        this._btnGeneratePdf.innerText = "Generando...";
        this._btnGeneratePdf.disabled = true;

        try {
          await this._generateDocument();
          this._modal.style.display = 'none';
        } catch (error) {
          console.error("Error al generar PDF:", error);
          alert("Error al generar el PDF. Revise la consola para más detalles.");
        } finally {
          this._btnGeneratePdf.innerText = originalText;
          this._btnGeneratePdf.disabled = false;
        }
      });
    } // Closes if (this._btnGeneratePdf)
  }

  _captureChart(chartId) {
    if (!window.dashboardUI || !window.dashboardUI._charts[chartId]) return null;
    const chart = window.dashboardUI._charts[chartId];
    try {
      // Fondo blanco para impresión nítida
      return chart.getDataURL({
        type: 'png',
        pixelRatio: 2,
        backgroundColor: '#ffffff'
      });
    } catch (e) {
      console.warn(`No se pudo capturar gráfico ${chartId}`, e);
      return null;
    }
  }

  async _generateDocument() {
    // Asegurarse de que window.jspdf existe
    if (!window.jspdf || !window.jspdf.jsPDF) {
      alert("La biblioteca jsPDF no está cargada correctamente.");
      return;
    }

    const { jsPDF } = window.jspdf;

    // Configuración: A4 o Letter, orientación apaisada (landscape) para que quepan las columnas
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'pt',
      format: 'letter'
    });

    // Obtener los datos agregados actuales
    if (!window.dataAggregator) return;

    // Obtener las filas filtradas
    const rawData = window.dataManager.getAllRaw();
    const filteredRows = window.filterManager ? window.filterManager.getFilteredData() : rawData.rows;

    // Recalcular explícitamente para asegurar que los datos estén frescos
    const headers = rawData.headers;
    const data = window.dataAggregator.computeAll(filteredRows, headers);

    const margin = 40;
    let startY = margin;

    // Filtros activos para el membrete
    const activeFilters = window.filterManager ? window.filterManager.getState() : {};
    const mesFiltro = activeFilters.mes || "Acumulado Anual";

    // Función helper para encabezados
    const addPageHeader = (title) => {
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(40, 40, 40);
      doc.text("REPORTE DE EJECUCIÓN PRESUPUESTARIA", margin, startY);

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 100, 100);
      const today = new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
      doc.text(`Fecha de generación: ${today} | Período: ${mesFiltro}`, margin, startY + 15);

      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(60, 60, 60);
      doc.text(title, margin, startY + 40);

      return startY + 60;
    };

    // Helper para insertar gráficos
    const addChart = (chartId, yPos) => {
      if (!this._chkGraficos || !this._chkGraficos.checked) return yPos;
      const imgData = this._captureChart(chartId);
      if (imgData) {
        const targetWidth = 500;
        const targetHeight = 220;
        const xPos = (792 - targetWidth) / 2; // Centrado en letter landscape (792 ancho)
        doc.addImage(imgData, 'PNG', xPos, yPos, targetWidth, targetHeight);
        return yPos + targetHeight + 20; // Nueva posición Y debajo del gráfico
      }
      return yPos;
    };

    let isFirstPage = true;

    // 1. Resumen Global (KPIs)
    if (this._chkKpis.checked) {
      startY = addPageHeader("Resumen Global (KPIs)");
      startY = addChart('chart-evolucion', startY);

      const t = data.grandTotals;
      const kpiData = [
        ["Asignado Inicial", this._fmtMoney(t['Asignado'])],
        ["Modificaciones (+/-)", this._fmtMoney(t['Modificación'])],
        ["Presupuesto Actualizado", this._fmtMoney(t['Monto Actualizado'])],
        ["Comprometido", this._fmtMoney(t['Comprometido'])],
        ["Causado", this._fmtMoney(t['Causado'])],
        ["Pagado", this._fmtMoney(t['Pagado'])],
        ["Disponible (Actualizado - Comprometido)", this._fmtMoney(t['Disponible'])]
      ];

      doc.autoTable({
        startY: startY,
        head: [['Indicador', 'Monto (Bs.)']],
        body: kpiData,
        theme: 'grid',
        headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
        bodyStyles: { textColor: [60, 60, 60] },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        columnStyles: {
          0: { cellWidth: 300, fontStyle: 'bold' },
          1: { halign: 'right' }
        },
        margin: { left: margin, right: margin }
      });
      isFirstPage = false;
    }

    // Configuración común para las tablas financieras
    const financeCols = ['Asignado', 'Modificación', 'Monto Actualizado', 'Comprometido', 'Causado', 'Pagado', 'Disponible'];

    const buildFinanceTable = (title, dataSource, keyName, keyLabel, chartId = null) => {
      if (!isFirstPage) {
        doc.addPage();
        startY = margin;
      }

      startY = addPageHeader(title);
      if (chartId) {
        startY = addChart(chartId, startY);
      }

      const headers = [keyLabel, 'Denominación', ...financeCols];

      const body = dataSource.map(row => {
        // Disponible no se calcula en _groupBy, solo en _computeGrandTotals
        const disponible = (row['Monto Actualizado'] || 0) - (row['Comprometido'] || 0);
        return [
          row[keyLabel] || '',
          row['Denominacion'] || '',
          this._fmtMoney(row['Asignado']),
          this._fmtMoney(row['Modificación']),
          this._fmtMoney(row['Monto Actualizado']),
          this._fmtMoney(row['Comprometido']),
          this._fmtMoney(row['Causado']),
          this._fmtMoney(row['Pagado']),
          this._fmtMoney(disponible)
        ];
      });

      doc.autoTable({
        startY: startY,
        head: [headers],
        body: body,
        theme: 'grid',
        headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold', fontSize: 8 },
        bodyStyles: { fontSize: 8, textColor: [50, 50, 50] },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        columnStyles: {
          0: { cellWidth: 70, fontStyle: 'bold' }, // Codigo
          1: { cellWidth: 'auto' }, // Denominacion
          2: { halign: 'right', cellWidth: 70 },
          3: { halign: 'right', cellWidth: 70 },
          4: { halign: 'right', cellWidth: 70 },
          5: { halign: 'right', cellWidth: 70 },
          6: { halign: 'right', cellWidth: 70 },
          7: { halign: 'right', cellWidth: 70 },
          8: { halign: 'right', cellWidth: 70 }
        },
        styles: { cellPadding: 3 },
        margin: { left: margin, right: margin },
        didDrawPage: (data) => {
          // Paginación al pie de página
          const str = "Página " + doc.internal.getNumberOfPages();
          doc.setFontSize(8);
          doc.setTextColor(150, 150, 150);
          doc.text(str, data.settings.margin.left, doc.internal.pageSize.height - 20);
        }
      });
      isFirstPage = false;
    };

    // 2. Resumen por Partida
    if (this._chkPartidas.checked) {
      buildFinanceTable("Resumen por Partida Principal", data.byPartida, 'partida', 'Partida', 'chart-partidas');
    }

    // 3. Resumen por Estructura
    if (this._chkEstructuras.checked) {
      buildFinanceTable("Resumen por Estructura Programática", data.byEstructura, 'ep', 'Estructura Programatica', 'chart-estructura');
    }

    // 4. Matriz Estructura x Partida
    if (this._chkMatriz.checked) {
      if (!isFirstPage) doc.addPage();
      startY = addPageHeader("Matriz Estructura × Partida");

      const headers = ['Estructura', 'Partida', 'Denominación', ...financeCols];

      const body = data.matrixEPPartida.map(row => {
        // Disponible no se calcula en _aggregateMatrixEPPartida, solo en _computeGrandTotals
        const disponible = (row['Monto Actualizado'] || 0) - (row['Comprometido'] || 0);
        return [
          row['EstructuraProgramatica'] || '',
          row['Partida'] || '',
          row['Denominacion'] || '',
          this._fmtMoney(row['Asignado']),
          this._fmtMoney(row['Modificación']),
          this._fmtMoney(row['Monto Actualizado']),
          this._fmtMoney(row['Comprometido']),
          this._fmtMoney(row['Causado']),
          this._fmtMoney(row['Pagado']),
          this._fmtMoney(disponible)
        ];
      });

      doc.autoTable({
        startY: startY,
        head: [headers],
        body: body,
        theme: 'grid',
        headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold', fontSize: 7 },
        bodyStyles: { fontSize: 7, textColor: [50, 50, 50] },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        columnStyles: {
          0: { cellWidth: 60, fontStyle: 'bold' },
          1: { cellWidth: 50, fontStyle: 'bold' },
          2: { cellWidth: 'auto' },
          3: { halign: 'right', cellWidth: 60 },
          4: { halign: 'right', cellWidth: 60 },
          5: { halign: 'right', cellWidth: 60 },
          6: { halign: 'right', cellWidth: 60 },
          7: { halign: 'right', cellWidth: 60 },
          8: { halign: 'right', cellWidth: 60 },
          9: { halign: 'right', cellWidth: 60 }
        },
        styles: { cellPadding: 2 },
        margin: { left: margin, right: margin },
        didDrawPage: (data) => {
          const str = "Página " + doc.internal.getNumberOfPages();
          doc.setFontSize(8);
          doc.setTextColor(150, 150, 150);
          doc.text(str, data.settings.margin.left, doc.internal.pageSize.height - 20);
        }
      });
      isFirstPage = false;
    }

    // 5. Genérica
    if (this._chkGenerica.checked) {
      buildFinanceTable("Detalle por Partida Genérica", data.byGenerica, 'generica', 'Generica');
    }

    // Guardar el PDF
    const filename = `Reporte_Presupuesto_${mesFiltro.replace(/\s+/g, '_')}_${new Date().getTime()}.pdf`;
    doc.save(filename);
  }
}

// Inicialización global
function initPdfExporter() {
  if (!window.pdfExporter) {
    window.pdfExporter = new PdfExporter();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPdfExporter);
} else {
  initPdfExporter();
}
