/* ================================================================
   DATA-MANAGER.JS — Gestión del estado de datos de la aplicación
   ================================================================
   Responsabilidades:
     - Almacenar los datos procesados
     - Proveer métodos de consulta, filtrado y ordenación
     - Mantener el estado de paginación
     - Métodos de agrupación para Dashboard y Análisis
   ================================================================ */

class DataManager {
  constructor() {
    /** @type {Array<Array>} Datos transformados completos */
    this._rawData = [];

    /** @type {Array<Array>} Datos filtrados actualmente */
    this._filteredData = [];

    /** @type {Array<string>} Nombres de las columnas */
    this._headers = [];

    /** @type {Object} Metadatos del archivo original */
    this._metadata = {};

    /** @type {number} Página actual */
    this._currentPage = 1;

    /** @type {number} Filas por página */
    this._rowsPerPage = APP_CONFIG.table.rowsPerPage;

    /** @type {number} Índice de columna de ordenación (-1 = sin orden) */
    this._sortColumn = -1;

    /** @type {boolean} Dirección de ordenación (true = ascendente) */
    this._sortAsc = true;

    /** @type {string} Texto de búsqueda activo */
    this._searchText = '';
  }

  /**
   * Carga datos transformados en el gestor
   * @param {Array<Array>} headers - Nombres de columnas
   * @param {Array<Array>} data - Datos transformados
   * @param {Object} [metadata={}] - Metadatos adicionales
   */
  loadData(headers, data, metadata = {}) {
    this._headers = [...headers];
    this._rawData = data.map(row => [...row]);
    this._metadata = metadata;
    this._currentPage = 1;
    this._sortColumn = -1;
    this._sortAsc = true;
    this._searchText = '';
    this._applyFilters();
  }

  /**
   * Aplica filtros y ordenación a los datos
   * @private
   */
  _applyFilters() {
    let data = [...this._rawData];

    // Filtro por búsqueda textual
    if (this._searchText.trim()) {
      const term = this._searchText.toLowerCase();
      data = data.filter(row =>
        row.some(cell =>
          String(cell).toLowerCase().includes(term)
        )
      );
    }

    // Ordenación
    if (this._sortColumn >= 0 && this._sortColumn < this._headers.length) {
      data.sort((a, b) => {
        const valA = a[this._sortColumn];
        const valB = b[this._sortColumn];
        const numA = parseFloat(valA);
        const numB = parseFloat(valB);

        // Comparación numérica si ambos son números
        if (!isNaN(numA) && !isNaN(numB)) {
          return this._sortAsc ? numA - numB : numB - numA;
        }

        // Comparación textual
        const strA = String(valA).toLowerCase();
        const strB = String(valB).toLowerCase();
        return this._sortAsc
          ? strA.localeCompare(strB)
          : strB.localeCompare(strA);
      });
    }

    this._filteredData = data;

    // Ajustar página si excede el total
    const maxPage = Math.max(1, Math.ceil(this._filteredData.length / this._rowsPerPage));
    if (this._currentPage > maxPage) this._currentPage = maxPage;
  }

  /**
   * Obtiene los datos de la página actual
   * @returns {{ headers: string[], rows: Array[], totalRows: number, currentPage: number, totalPages: number }}
   */
  getCurrentPage() {
    const start = (this._currentPage - 1) * this._rowsPerPage;
    const end = start + this._rowsPerPage;
    const pageRows = this._filteredData.slice(start, end);

    return {
      headers: this._headers,
      rows: pageRows,
      totalRows: this._filteredData.length,
      currentPage: this._currentPage,
      totalPages: Math.max(1, Math.ceil(this._filteredData.length / this._rowsPerPage)),
      rowsPerPage: this._rowsPerPage,
      startRow: start + 1,
      endRow: Math.min(end, this._filteredData.length)
    };
  }

  /**
   * Obtiene todos los datos filtrados (sin paginar)
   * @returns {{ headers: string[], rows: Array[] }}
   */
  getAllFiltered() {
    return {
      headers: this._headers,
      rows: this._filteredData
    };
  }

  /**
   * Obtiene todos los datos originales (sin filtros)
   * @returns {{ headers: string[], rows: Array[] }}
   */
  getAllRaw() {
    return {
      headers: this._headers,
      rows: this._rawData
    };
  }

  // ---- MÉTODOS DE NAVEGACIÓN ---- //

  nextPage() {
    const maxPage = Math.ceil(this._filteredData.length / this._rowsPerPage);
    if (this._currentPage < maxPage) {
      this._currentPage++;
      return true;
    }
    return false;
  }

  prevPage() {
    if (this._currentPage > 1) {
      this._currentPage--;
      return true;
    }
    return false;
  }

  goToPage(page) {
    const maxPage = Math.max(1, Math.ceil(this._filteredData.length / this._rowsPerPage));
    const newPage = Math.max(1, Math.min(page, maxPage));
    if (newPage !== this._currentPage) {
      this._currentPage = newPage;
      return true;
    }
    return false;
  }

  // ---- MÉTODOS DE ORDENACIÓN ---- //

  /**
   * Ordena por una columna
   * @param {number} columnIndex - Índice de la columna
   */
  sortBy(columnIndex) {
    if (this._sortColumn === columnIndex) {
      this._sortAsc = !this._sortAsc;
    } else {
      this._sortColumn = columnIndex;
      this._sortAsc = true;
    }
    this._currentPage = 1;
    this._applyFilters();
  }

  /**
   * Obtiene el estado actual de ordenación
   * @returns {{ column: number, asc: boolean }}
   */
  getSortState() {
    return {
      column: this._sortColumn,
      asc: this._sortAsc
    };
  }

  // ---- MÉTODOS DE BÚSQUEDA ---- //

  /**
   * Establece el texto de búsqueda
   * @param {string} text
   */
  search(text) {
    this._searchText = text.trim();
    this._currentPage = 1;
    this._applyFilters();
  }

  // ---- MÉTODOS DE RESUMEN ---- //

  /**
   * Calcula resúmenes estadísticos de los datos
   * @returns {Object}
   */
  getSummary() {
    const totalRows = this._rawData.length;
    const numericFields = ['Asignado', 'Aumento', 'Disminucion', 'Modificación',
      'Monto Actualizado', 'Pre Comprometido', 'Comprometido',
      'Causado', 'Pagado', 'Por Pagar'];

    const summary = {
      totalRows,
      totalFilteredRows: this._filteredData.length,
      totals: {}
    };

    // Calcular sumatorias
    numericFields.forEach(field => {
      const colIndex = this._headers.indexOf(field);
      if (colIndex >= 0) {
        const total = this._rawData.reduce((sum, row) => {
          const val = parseFloat(row[colIndex]) || 0;
          return sum + val;
        }, 0);
        summary.totals[field] = total;
      }
    });

    // Contar estructuras programáticas únicas
    const epIndex = this._headers.indexOf('Estructura Programatica');
    if (epIndex >= 0) {
      const uniqueEP = new Set(this._rawData.map(r => r[epIndex]));
      summary.uniqueEstructuras = uniqueEP.size;
    }

    // Contar cuentas únicas
    const cuentaIndex = this._headers.indexOf('Cuenta');
    if (cuentaIndex >= 0) {
      const uniqueCuentas = new Set(this._rawData.map(r => r[cuentaIndex]));
      summary.uniqueCuentas = uniqueCuentas.size;
    }

    return summary;
  }

  // ---- MÉTODOS PARA DASHBOARD / ANÁLISIS ---- //

  /**
   * Obtiene valores únicos de una columna
   * @param {string} columnName
   * @returns {string[]}
   */
  getUniqueValues(columnName) {
    const idx = this._headers.indexOf(columnName);
    if (idx < 0) return [];
    return [...new Set(this._rawData.map(r => String(r[idx] || '').trim()).filter(v => v))].sort();
  }

  /**
   * Agrupa datos por mes para gráfico de evolución
   * @param {Array<Array>} rows - Filas a agrupar
   * @returns {Map<string, Object>}
   */
  groupByMonth(rows) {
    const fechaIdx = this._headers.indexOf('Fecha');
    const compIdx = this._headers.indexOf('Comprometido');
    const causIdx = this._headers.indexOf('Causado');
    const pagIdx = this._headers.indexOf('Pagado');

    const map = new Map();
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

    (rows || this._filteredData).forEach(row => {
      const fecha = String(row[fechaIdx] || '');
      const parts = fecha.split('/');
      if (parts.length < 3) return;

      const mesNum = parseInt(parts[1]) - 1;
      const mesKey = meses[mesNum] || 'N/A';

      if (!map.has(mesKey)) {
        map.set(mesKey, { comprometido: 0, causado: 0, pagado: 0, orden: mesNum });
      }
      const d = map.get(mesKey);
      d.comprometido += parseFloat(row[compIdx]) || 0;
      d.causado += parseFloat(row[causIdx]) || 0;
      d.pagado += parseFloat(row[pagIdx]) || 0;
    });

    return map;
  }

  /**
   * Obtiene los top N proveedores por monto pagado
   * @param {Array<Array>} rows
   * @param {number} n
   * @returns {Array<{name: string, value: number}>}
   */
  getTopProviders(rows, n = 10) {
    const provIdx = this._headers.indexOf('Proveedor/Beneficiario');
    const pagIdx = this._headers.indexOf('Pagado');
    if (provIdx < 0 || pagIdx < 0) return [];

    const map = new Map();
    (rows || this._filteredData).forEach(row => {
      const p = String(row[provIdx] || '').trim();
      if (!p || p === 'Ninguno') return;
      map.set(p, (map.get(p) || 0) + (parseFloat(row[pagIdx]) || 0));
    });

    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([name, value]) => ({ name, value }));
  }

  /**
   * Filtra por partida
   * @param {Array<Array>} rows
   * @param {string} partidaPrefix - Ej: '4.01'
   * @returns {Array<Array>}
   */
  getByPartida(rows, partidaPrefix) {
    const pIdx = this._headers.indexOf('Partida');
    if (pIdx < 0) return [];
    return (rows || this._filteredData).filter(row =>
      String(row[pIdx] || '').startsWith(partidaPrefix)
    );
  }

  /**
   * Filtra por estructura programática
   * @param {Array<Array>} rows
   * @param {string} epPrefix - Ej: 'PR1'
   * @returns {Array<Array>}
   */
  getByEstructura(rows, epPrefix) {
    const epIdx = this._headers.indexOf('Estructura Programatica');
    if (epIdx < 0) return [];
    return (rows || this._filteredData).filter(row =>
      String(row[epIdx] || '').startsWith(epPrefix)
    );
  }

  /**
   * Obtiene la ejecución por acción específica
   * @param {Array<Array>} rows
   * @returns {Array<{accion: string, actualizado: number, pagado: number, ejecucion: number}>}
   */
  getExecutionByAction(rows) {
    const accIdx = this._headers.indexOf('Accion Especifica');
    const actIdx = this._headers.indexOf('Monto Actualizado');
    const pagIdx = this._headers.indexOf('Pagado');
    if (accIdx < 0) return [];

    const map = new Map();
    (rows || this._filteredData).forEach(row => {
      const acc = String(row[accIdx] || '').trim();
      if (!acc) return;
      if (!map.has(acc)) map.set(acc, { actualizado: 0, pagado: 0 });
      const d = map.get(acc);
      d.actualizado += parseFloat(row[actIdx]) || 0;
      d.pagado += parseFloat(row[pagIdx]) || 0;
    });

    return Array.from(map.entries())
      .map(([accion, { actualizado, pagado }]) => ({
        accion,
        actualizado,
        pagado,
        ejecucion: actualizado > 0 ? (pagado / actualizado * 100) : 0
      }))
      .sort((a, b) => b.pagado - a.pagado);
  }

  /**
   * Obtiene metadatos del archivo
   * @returns {Object}
   */
  getMetadata() {
    return { ...this._metadata };
  }

  /**
   * Limpia todos los datos
   */
  clear() {
    this._rawData = [];
    this._filteredData = [];
    this._headers = [];
    this._metadata = {};
    this._currentPage = 1;
    this._sortColumn = -1;
    this._sortAsc = true;
    this._searchText = '';
  }
}

// Instancia global única (Singleton)
const dataManager = new DataManager();
window.dataManager = dataManager;
