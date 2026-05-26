/* ================================================================
   UI-CONTROLLER.JS — Controlador de la interfaz de usuario
   ================================================================
   Responsabilidades:
     - Manejar eventos de la UI (drag & drop, clics, búsqueda)
     - Renderizar tabla con Tabulator (oculta por defecto)
     - Mostrar/esconder secciones según el estado
     - Manejar la barra de progreso
   ================================================================ */

class UIController {
  constructor() {
    // ---- Referencias a elementos del DOM ---- //
    this._dropZone = document.getElementById('dropZone');
    this._fileInput = document.getElementById('fileInput');
    this._btnSelectFile = document.getElementById('btnSelectFile');
    this._btnChangeFile = document.getElementById('btnChangeFile');
    this._btnProcess = document.getElementById('btnProcess');
    this._fileInfo = document.getElementById('fileInfo');
    this._fileName = document.getElementById('fileName');
    this._fileSize = document.getElementById('fileSize');
    this._progressBar = document.getElementById('progressBar');
    this._progressFill = document.getElementById('progressFill');
    this._progressText = document.getElementById('progressText');

    // Table
    this._tableSectionWrapper = document.getElementById('table-section-wrapper');
    this._tableToggleBar = document.getElementById('tableToggleBar');
    this._tableSearch = document.getElementById('tableSearch');
    this._btnExportCSV = document.getElementById('btnExportCSV');
    // Custom Report Builder (NUEVO)
    this._btnGenerateReport = document.getElementById('btnGenerateReport');
    this._btnClearReport = document.getElementById('btnClearReport');
    this._reportPills = document.querySelectorAll('.report-pill');
    this._reportDimensions = []; // Array que mantendrá el orden de selección
    this._tableRowCount = document.getElementById('tableRowCount');

    // Secciones
    this._kpiSection = document.getElementById('kpi-section');
    this._filtersSection = document.getElementById('filters-section');
    this._chartsSection = document.getElementById('charts-section');
    this._analysisSection = document.getElementById('analysis-section');

    // Año del footer
    document.getElementById('year').textContent = new Date().getFullYear();

    // Logo
    this._initLogo();

    // Estado
    this._currentFile = null;
    this._tableOpen = false;
    this._tabulatorInstance = null;
    this._groupEnabled = false;
    this._isSubscribed = false;

    // Estado para vista resumida
    this._lastFilteredData = null;    // Últimos datos filtrados (para re-renderizar al cambiar agrupación)
    this._aggregatedData = null;      // Datos agregados actuales (para exportación)
    this._reportMode = false;         // Indica si estamos en modo reporte personalizado
    this._reportDimensions = [];      // Array que mantendrá el orden de selección

    // Bind de eventos
    this._bindEvents();
  }

  /**
   * Inicializa el logo desde las variables CSS
   * @private
   */
  _initLogo() {
    const logo = document.getElementById('logo');
    const logoUrl = getComputedStyle(document.documentElement)
      .getPropertyValue('--app-logo-url').trim();

    if (logoUrl && logoUrl !== 'none' && !logoUrl.startsWith('url()')) {
      const match = logoUrl.match(/url\(['"]?(.*?)['"]?\)/);
      if (match) {
        logo.src = match[1];
      }
    }
  }

  /**
   * Vincula todos los eventos de la UI
   * @private
   */
  _bindEvents() {
    // ---- Drag & Drop ---- //
    this._dropZone.addEventListener('click', () => this._fileInput.click());
    this._dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      this._dropZone.classList.add('drag-over');
    });
    this._dropZone.addEventListener('dragleave', () => {
      this._dropZone.classList.remove('drag-over');
    });
    this._dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      this._dropZone.classList.remove('drag-over');
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        this._onFileSelected(files[0]);
      }
    });

    // ---- Botón seleccionar archivo ---- //
    this._btnSelectFile.addEventListener('click', (e) => {
      e.stopPropagation();
      this._fileInput.click();
    });

    this._fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        this._onFileSelected(e.target.files[0]);
      }
    });

    // ---- Botones de archivo ---- //
    this._btnChangeFile.addEventListener('click', () => {
      this._fileInput.click();
    });

    this._btnProcess.addEventListener('click', () => {
      if (this._currentFile) {
        this._onProcessFile();
      }
    });

    // ---- Table Toggle (botón para mostrar/ocultar tabla) ---- //
    this._tableToggleBar.addEventListener('click', () => {
      this._toggleTable();
    });

    // ---- Búsqueda en tabla ---- //
    let searchTimer = null;
    this._tableSearch.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        if (this._tabulatorInstance) {
          const term = this._tableSearch.value.trim();
          if (term) {
            this._tabulatorInstance.setFilter(this._createSearchFilter(term));
          } else {
            this._tabulatorInstance.clearFilter();
          }
        }
      }, 300);
    });

    // ---- Exportar CSV ---- //
    this._btnExportCSV.addEventListener('click', () => this._exportCSV());

    // (Botón "Agrupar por partida" fue eliminado a favor del nuevo generador de reportes)

    // ---- Lógica del Generador de Reportes ---- //
    this._reportPills.forEach(pill => {
      pill.addEventListener('click', (e) => {
        const dim = pill.getAttribute('data-dim');
        const isSelected = pill.classList.contains('selected');
        
        if (isSelected) {
          // Deseleccionar
          pill.classList.remove('selected');
          const badge = pill.querySelector('.pill-badge');
          if (badge) badge.style.display = 'none';
          this._reportDimensions = this._reportDimensions.filter(d => d !== dim);
        } else {
          // Seleccionar
          pill.classList.add('selected');
          this._reportDimensions.push(dim);
        }
        
        // Actualizar números de orden
        this._reportDimensions.forEach((d, index) => {
          const activePill = document.querySelector(`.report-pill[data-dim="${d}"]`);
          if (activePill) {
            const badge = activePill.querySelector('.pill-badge');
            if (badge) {
              badge.textContent = index + 1;
              badge.style.display = 'inline-flex';
            }
          }
        });
      });
    });

    this._btnGenerateReport.addEventListener('click', () => {
      if (this._reportDimensions.length === 0) {
        alert('Por favor selecciona al menos una dimensión para el reporte.');
        return;
      }
      this._reportMode = true;
      if (this._tabulatorInstance && this._lastFilteredData) {
        this._updateTabulator(this._lastFilteredData);
      }
    });

    this._btnClearReport.addEventListener('click', () => {
      // Limpiar selección
      this._reportDimensions = [];
      this._reportPills.forEach(pill => {
        pill.classList.remove('selected');
        const badge = pill.querySelector('.pill-badge');
        if (badge) badge.style.display = 'none';
      });
      
      this._reportMode = false;
      if (this._tabulatorInstance && this._lastFilteredData) {
        this._updateTabulator(this._lastFilteredData);
      }
    });

    // ---- Exportar Resumen ---- //
    this._btnExportResumen.addEventListener('click', () => this._exportResumenCSV());
  }

  /**
   * Crea filtro de búsqueda para Tabulator
   * @param {string} term
   * @returns {Array}
   * @private
   */
  _createSearchFilter(term) {
    const lowerTerm = term.toLowerCase();
    return [{
      field: '_search',
      type: 'custom',
      value: lowerTerm,
      func: (data) => {
        return Object.values(data).some(v =>
          String(v).toLowerCase().includes(lowerTerm)
        );
      }
    }];
  }

  /**
   * Maneja la selección de un archivo
   * @param {File} file
   * @private
   */
  _onFileSelected(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    const validExts = ['xlsx', 'xls', 'csv'];

    if (!validExts.includes(ext)) {
      this._showToast('Formato no soportado. Usa archivos .xlsx, .xls o .csv', 'error');
      return;
    }

    this._currentFile = file;

    // Mostrar info del archivo
    this._dropZone.classList.add('hidden');
    this._fileInfo.classList.remove('hidden');
    this._fileName.textContent = file.name;
    this._fileSize.textContent = this._formatFileSize(file.size);

    // Resetear valor del input para permitir seleccionar el mismo archivo nuevamente
    this._fileInput.value = '';
  }

  /**
   * Procesa el archivo seleccionado
   * @private
   */
  async _onProcessFile() {
    if (!this._currentFile) return;

    this._showProgress(true);
    this._setProgress(10, 'Leyendo archivo...');

    // Limpiar UI para asegurar que no quede información vieja en pantalla
    this._kpiSection.classList.add('hidden');
    this._filtersSection.classList.add('hidden');
    this._chartsSection.classList.add('hidden');
    this._analysisSection.classList.add('hidden');
    this._tableSectionWrapper.classList.add('hidden');
    const aggregationSection = document.getElementById('aggregation-section');
    if (aggregationSection) aggregationSection.classList.add('hidden');

    try {
      // Procesar el Excel
      const result = await excelProcessor.process(this._currentFile);

      this._setProgress(40, 'Transformando datos...');

      if (result.headers.length === 0 || result.rows.length === 0) {
        this._showToast('No se encontraron datos válidos en el archivo.', 'warning');
        this._showProgress(false);
        return;
      }

      // Cargar datos en el gestor
      dataManager.loadData(result.headers, result.rows, result.metadata);

      // ================================================================
      //  LIMPIAR ESTADO ANTERIOR (al cargar un nuevo archivo)
      //  Orden crítico:
      //  1. Invalidar cache de agregación (evita datos obsoletos)
      //  2. Resetear UI de agregación (limpia tabs, páginas, búsqueda)
      //  3. Resetear filtros (limpia estado anterior, notifica suscriptores
      //     que recalcularán con datos frescos al no haber cache)
      //  4. Poblar filtros con datos del nuevo archivo
      // ================================================================
      dataAggregator.invalidateCache();
      aggregatorUI.reset();
      filterManager.resetAll();

      this._setProgress(60, 'Configurando filtros...');

      // Poblar filtros con los datos del nuevo archivo
      filterManager.populateFromData();

      this._setProgress(70, 'Unificando datos por jerarquías...');

      // ================================================================
      //  PASO CRÍTICO: AGREGACIÓN / UNIFICACIÓN DE DATOS
      //  Antes de mostrar cualquier gráfico, transformamos los datos
      //  transaccionales en resúmenes jerárquicos (Partida, EP, etc.)
      // ================================================================
      const headers = result.headers;
      const allRows = result.rows;

      // Calcular todas las agregaciones (cache ya invalidado)
      const aggregations = dataAggregator.computeAll(allRows, headers);

      // Renderizar las vistas unificadas (tabs con tablas resumen)
      aggregatorUI.render(aggregations);

      this._setProgress(80, 'Generando dashboard...');

      // Obtener datos filtrados iniciales
      const filteredData = filterManager.getFilteredData();
      this._lastFilteredData = filteredData;

      // Renderizar KPIs
      kpiManager.update(filteredData);

      // Renderizar dashboard (gráficos ECharts)
      dashboard.init();
      dashboard.updateAll(filteredData, filterManager.getState());

      // Renderizar análisis
      analysisManager.update(filteredData);

      this._setProgress(92, 'Preparando tabla...');

      // Inicializar Tabulator (pero no mostrar aún)
      this._initTabulator(filteredData, result.headers);

      this._setProgress(100, '¡Listo!');

      // Suscribir al filter manager para actualizaciones (SOLO UNA VEZ)
      if (!this._isSubscribed) {
        filterManager.subscribe((newData, filterState) => {
          this._lastFilteredData = newData;
          kpiManager.update(newData);
          dashboard.updateAll(newData, filterState);
          analysisManager.update(newData);
          this._updateTabulator(newData);

          // Re-calcular agregaciones cuando cambian los filtros
          const rawData = dataManager.getAllRaw();
          if (rawData.rows.length > 0) {
            const filteredAggregations = dataAggregator.computeAll(newData, rawData.headers);
            aggregatorUI.render(filteredAggregations);
          }
        });
        this._isSubscribed = true;
      }

      setTimeout(() => {
        this._showProgress(false);

        // Mostrar todas las secciones
        this._kpiSection.classList.remove('hidden');
        this._filtersSection.classList.remove('hidden');
        this._chartsSection.classList.remove('hidden');
        this._analysisSection.classList.remove('hidden');
        this._tableSectionWrapper.classList.remove('hidden');

        this._showToast(`¡Procesado exitoso! ${result.rows.length} transacciones encontradas.`, 'success');
      }, 300);

    } catch (err) {
      this._showProgress(false);
      this._showToast(`Error al procesar: ${err.message}`, 'error');
      console.error('Process error:', err);
    }
  }

  // ---- TABULATOR ---- //

  /**
   * Inicializa la instancia de Tabulator
   * @param {Array<Array>} rows - Datos
   * @param {Array<string>} headers - Cabeceras
   * @private
   */
  _initTabulator(rows, headers) {
    if (this._tabulatorInstance) {
      this._tabulatorInstance.destroy();
    }

    this._tabulatorInstance = new Tabulator('#tabulator-table', {
      layout: 'fitDataFill',
      height: '500px',
      pagination: true,
      paginationSize: 50,
      paginationSizeSelector: [25, 50, 100, 200],
      movableColumns: true,
      resizableRows: false,
      placeholder: 'No hay datos para mostrar',
      columns: [{ title: '...', field: '_placeholder', visible: false }],
      rowFormatter: (row) => {
        if (row.getPosition() % 2 === 0) {
          row.getElement().style.backgroundColor = 'var(--color-bg-elevated)';
        }
      }
    });

    // Delegar el llenado de datos/columnas a _updateTabulator
    // (maneja tanto vista detallada como resumida) una vez que la tabla esté construida
    this._tabulatorInstance.on("tableBuilt", () => {
      this._updateTabulator(rows);
    });
  }

  /**
   * Construye las columnas de Tabulator
   * @param {string[]} headers
   * @returns {Array}
   * @private
   */
  _buildTabulatorColumns(headers) {
    const numericCols = ['Asignado', 'Aumento', 'Disminucion', 'Modificación',
      'Monto Actualizado', 'Pre Comprometido', 'Comprometido',
      'Causado', 'Pagado', 'Por Pagar'];

    // Columnas visibles principales para la tabla
    const visibleCols = [
      'Fecha', 'Proveedor/Beneficiario', 'Denominacion', 'Accion Especifica',
      'Partida', 'Monto Actualizado', 'Comprometido', 'Causado', 'Pagado', 'Por Pagar'
    ];

    return headers.map(h => {
      const isNumeric = numericCols.includes(h);
      const isVisible = visibleCols.includes(h);

      const col = {
        title: h,
        field: h,
        headerFilter: false,
        sorter: isNumeric ? 'number' : 'string',
        visible: isVisible
      };

      if (isNumeric) {
        col.formatter = (cell) => {
          const val = cell.getValue();
          if (val === 0 || val === null || val === undefined) return '0,00';
          return Number(val).toLocaleString('es-ES', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          });
        };
        col.hozAlign = 'right';
        col.width = 140;
      }

      if (h === 'Fecha') col.width = 100;
      if (h === 'Proveedor/Beneficiario') col.width = 220;
      if (h === 'Denominacion') col.width = 260;
      if (h === 'Accion Especifica') col.width = 240;
      if (h === 'Partida') col.width = 130;

      return col;
    });
  }

  /**
   * Convierte array de arrays a array de objetos para Tabulator
   * @param {Array<Array>} rows
   * @param {string[]} headers
   * @returns {Object[]}
   * @private
   */
  _rowsToObjects(rows, headers) {
    return rows.map(row => {
      const obj = {};
      headers.forEach((h, i) => {
        obj[h] = row[i] !== undefined ? row[i] : '';
      });
      return obj;
    });
  }

  /**
   * Actualiza los datos de Tabulator
   * @param {Array<Array>} filteredRows
   * @private
   */
  _updateTabulator(filteredRows) {
    if (!this._tabulatorInstance) return;
    const headers = filterManager.getHeaders();

    if (this._reportMode && this._reportDimensions.length > 0) {
      // ===== VISTA RESUMEN (agrupada multidimensional) =====
      const aggData = this._computeAggregation(filteredRows, headers, this._reportDimensions);
      const aggColumns = this._buildAggregatedColumns(this._reportDimensions);
      this._tabulatorInstance.setColumns(aggColumns);
      this._tabulatorInstance.replaceData(aggData);
      this._tabulatorInstance.setGroupBy(false);
      this._aggregatedData = aggData;
      this._tableRowCount.textContent = `${aggData.length} fila(s) generada(s) · ${filteredRows.length} registros`;
    } else {
      // ===== VISTA DETALLADA (filas individuales) =====
      const data = this._rowsToObjects(filteredRows, headers);
      const columns = this._buildTabulatorColumns(headers);
      this._tabulatorInstance.setColumns(columns);
      this._tabulatorInstance.replaceData(data);
      this._aggregatedData = null;
      this._tableRowCount.textContent = `${filteredRows.length} registros`;

      this._tabulatorInstance.setGroupBy(false);
    }
  }

  // ---- VISTA RESUMEN (AGRUPADA) ---- //

  /**
   * Computa la agregación de datos agrupados por MÚLTIPLES dimensiones.
   * @param {Array<Array>} filteredRows
   * @param {string[]} headers
   * @param {string[]} dimensions - Array de dimensiones ('mes','estructura','generica', etc.)
   * @returns {Object[]}
   * @private
   */
  _computeAggregation(filteredRows, headers, dimensions) {
    const rawData = dataManager.getAllRaw();
    const rawHeaders = rawData.headers;
    const rawRows = rawData.rows;

    const getIdx = (h) => headers.indexOf(h);
    const getRawIdx = (h) => rawHeaders.indexOf(h);

    const groupColMap = {
      mes: 'Fecha',
      estructura: 'Estructura Programatica',
      accion: 'Accion Especifica',
      unidad: 'Unidad Ejecutora',
      generica: 'Generica',
      especifica: 'Especifica',
      subespecifica: 'Sub-especifica',
      proveedor: 'Proveedor/Beneficiario'
    };

    // Helper para extraer la parte del valor de una dimensión
    const extractKeyPart = (row, idx, dim) => {
      const val = String(row[idx] || '').trim();
      if (!val) return 'Sin Asignar';
      if (dim === 'mes') {
        const parts = val.split('/');
        if (parts.length === 3) {
          const m = parseInt(parts[1], 10);
          const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
          return isNaN(m) || m < 1 || m > 12 ? 'Mes Inválido' : `${m.toString().padStart(2, '0')} - ${meses[m-1]}`;
        }
        return 'Sin Fecha';
      }
      return val;
    };

    // Helper para crear la clave combinada (dim1|dim2|dim3)
    const buildCompoundKey = (row, isRaw) => {
      const parts = dimensions.map(dim => {
        const colName = groupColMap[dim];
        const idx = isRaw ? getRawIdx(colName) : getIdx(colName);
        return extractKeyPart(row, idx, dim);
      });
      return {
        compoundKey: parts.join('|'),
        parts: parts
      };
    };

    // Índices de columnas presupuestarias (RAW)
    const rawCuentaIdx = getRawIdx('Cuenta');
    const rawAsignadoIdx = getRawIdx('Asignado');
    const rawAumentoIdx = getRawIdx('Aumento');
    const rawDisminucionIdx = getRawIdx('Disminucion');

    // Índices de columnas de ejecución (FILTRADAS)
    const comprometidoIdx = getIdx('Comprometido');
    const causadoIdx = getIdx('Causado');
    const pagadoIdx = getIdx('Pagado');

    // ---- FASE 1: Montos presupuestarios desde RAW ---- //
    const rawBudgetMap = new Map();
    rawRows.forEach(row => {
      const { compoundKey, parts } = buildCompoundKey(row, true);
      if (!compoundKey) return;
      if (!rawBudgetMap.has(compoundKey)) {
        rawBudgetMap.set(compoundKey, { parts, cuentas: new Set(), asignado: 0, aumento: 0, disminucion: 0 });
      }
      const entry = rawBudgetMap.get(compoundKey);
      const cuenta = String(row[rawCuentaIdx] || '').trim();
      if (cuenta && !entry.cuentas.has(cuenta)) {
        entry.cuentas.add(cuenta);
        entry.asignado += parseFloat(row[rawAsignadoIdx]) || 0;
        entry.aumento += parseFloat(row[rawAumentoIdx]) || 0;
        entry.disminucion += parseFloat(row[rawDisminucionIdx]) || 0;
      }
    });

    // ---- FASE 2: Montos de ejecución desde FILTRADOS ---- //
    const execMap = new Map();
    filteredRows.forEach(row => {
      const { compoundKey, parts } = buildCompoundKey(row, false);
      if (!compoundKey) return;
      if (!execMap.has(compoundKey)) {
        execMap.set(compoundKey, { parts, comprometido: 0, causado: 0, pagado: 0 });
      }
      const entry = execMap.get(compoundKey);
      entry.comprometido += parseFloat(row[comprometidoIdx]) || 0;
      entry.causado += parseFloat(row[causadoIdx]) || 0;
      entry.pagado += parseFloat(row[pagadoIdx]) || 0;
    });

    // ---- FUSIONAR ---- //
    const allKeys = new Set([...rawBudgetMap.keys(), ...execMap.keys()]);
    const results = [];

    allKeys.forEach(compoundKey => {
      const budget = rawBudgetMap.get(compoundKey) || { asignado: 0, aumento: 0, disminucion: 0 };
      const exec = execMap.get(compoundKey) || { comprometido: 0, causado: 0, pagado: 0 };
      const parts = rawBudgetMap.has(compoundKey) ? rawBudgetMap.get(compoundKey).parts : execMap.get(compoundKey).parts;
      
      const rowObj = {};
      dimensions.forEach((dim, idx) => {
        rowObj[this._getGroupLabel(dim)] = parts[idx];
      });

      rowObj['Asignado'] = budget.asignado;
      rowObj['Modificación'] = budget.aumento - budget.disminucion;
      rowObj['Comprometido'] = exec.comprometido;
      rowObj['Causado'] = exec.causado;
      rowObj['Pagado'] = exec.pagado;

      results.push(rowObj);
    });

    // Ordenar por las dimensiones (de izquierda a derecha)
    results.sort((a, b) => {
      for (let dim of dimensions) {
        const label = this._getGroupLabel(dim);
        const aVal = String(a[label] || '');
        const bVal = String(b[label] || '');
        const cmp = aVal.localeCompare(bVal, undefined, { numeric: true });
        if (cmp !== 0) return cmp;
      }
      return 0;
    });

    return results;
  }

  /**
   * Retorna la etiqueta legible para la columna de grupo
   * @param {string} groupBy
   * @returns {string}
   * @private
   */
  _getGroupLabel(groupBy) {
    const labels = {
      mes: 'Mes',
      estructura: 'Estructura Programática',
      accion: 'Acción Específica',
      unidad: 'Unidad Ejecutora',
      generica: 'Partida Genérica',
      especifica: 'Partida Específica',
      subespecifica: 'Sub-específica',
      proveedor: 'Proveedor / Beneficiario'
    };
    return labels[groupBy] || 'Grupo';
  }

  /**
   * Construye las columnas de Tabulator para la vista resumida
   * @param {string} groupBy
   * @returns {Array}
   * @private
   */
  _buildAggregatedColumns(dimensions) {
    const fmt = (cell) => {
      const val = cell.getValue();
      if (val === 0 || val === null || val === undefined) return '0,00';
      return Number(val).toLocaleString('es-ES', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
    };
    
    // Primero, crear las columnas dinámicas para las dimensiones
    const cols = dimensions.map(dim => {
      return { 
        title: this._getGroupLabel(dim), 
        field: this._getGroupLabel(dim), 
        width: 200, 
        sorter: 'string' 
      };
    });

    // Luego agregar las columnas financieras
    cols.push(
      { title: 'Asignado', field: 'Asignado', formatter: fmt, hozAlign: 'right', width: 150, sorter: 'number' },
      { title: 'Modificación', field: 'Modificación', formatter: fmt, hozAlign: 'right', width: 150, sorter: 'number' },
      { title: 'Comprometido', field: 'Comprometido', formatter: fmt, hozAlign: 'right', width: 150, sorter: 'number' },
      { title: 'Causado', field: 'Causado', formatter: fmt, hozAlign: 'right', width: 150, sorter: 'number' },
      { title: 'Pagado', field: 'Pagado', formatter: fmt, hozAlign: 'right', width: 150, sorter: 'number' }
    );
    
    return cols;
  }

  /**
   * Exporta la vista resumida a CSV
   * @private
   */
  _exportResumenCSV() {
    if (!this._aggregatedData || this._aggregatedData.length === 0) {
      this._showToast('No hay datos de resumen para exportar.', 'warning');
      return;
    }

    const headers = Object.keys(this._aggregatedData[0]);
    const csvRows = [headers.join(';')];
    this._aggregatedData.forEach(row => {
      csvRows.push(headers.map(h => {
        const val = row[h];
        if (typeof val === 'number') {
          return Number(val).toLocaleString('es-ES', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          });
        }
        return `"${String(val).replace(/"/g, '""')}"`;
      }).join(';'));
    });

    const csv = '\uFEFF' + csvRows.join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reporte_personalizado_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    this._showToast('Resumen exportado exitosamente.', 'success');
  }

  /**
   * Formato corto de moneda para grupo
   * @param {number} v
   * @returns {string}
   * @private
   */
  _fmtShort(v) {
    const abs = Math.abs(v);
    if (abs >= 1_000_000) return (abs / 1_000_000).toFixed(2) + 'M';
    if (abs >= 1_000) return (abs / 1_000).toFixed(1) + 'K';
    return abs.toFixed(0);
  }

  /**
   * Toggle para mostrar/ocultar la tabla
   * @private
   */
  _toggleTable() {
    this._tableOpen = !this._tableOpen;

    if (this._tableOpen) {
      this._tableSectionWrapper.classList.add('table-open');
    } else {
      this._tableSectionWrapper.classList.remove('table-open');
    }

    // Resize tabulator cuando se abre
    if (this._tableOpen && this._tabulatorInstance) {
      setTimeout(() => {
        this._tabulatorInstance.redraw(true);
      }, 500);
    }
  }

  // ---- BARRA DE PROGRESO ---- //

  /**
   * Muestra/oculta la barra de progreso
   * @param {boolean} show
   * @private
   */
  _showProgress(show) {
    if (show) {
      this._progressBar.classList.remove('hidden');
    } else {
      this._progressBar.classList.add('hidden');
      this._setProgress(0, '');
    }
  }

  /**
   * Establece el progreso actual
   * @param {number} percent
   * @param {string} text
   * @private
   */
  _setProgress(percent, text) {
    this._progressFill.style.width = `${percent}%`;
    this._progressText.textContent = text;
  }

  // ---- EXPORTAR CSV ---- //

  /**
   * Exporta los datos actuales a CSV
   * @private
   */
  _exportCSV() {
    if (this._tabulatorInstance) {
      this._tabulatorInstance.download('csv', `presupuesto_export_${new Date().toISOString().slice(0, 10)}.csv`, {
        bom: true
      });
      this._showToast('CSV exportado exitosamente.', 'success');
    } else {
      this._showToast('No hay datos para exportar.', 'warning');
    }
  }

  // ---- TOAST / NOTIFICACIONES ---- //

  /**
   * Muestra una notificación temporal
   * @param {string} message
   * @param {'success'|'error'|'warning'|'info'} type
   * @private
   */
  _showToast(message, type = 'info') {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  // ---- UTILIDADES ---- //

  /**
   * Formatea el tamaño de archivo
   * @param {number} bytes
   * @returns {string}
   * @private
   */
  _formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

// Instancia global
const uiController = new UIController();
window.uiController = uiController;
