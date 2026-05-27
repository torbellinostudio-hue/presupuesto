/* ================================================================
   KPI-MANAGER.JS — Cálculo y renderizado de KPIs con animación
   ================================================================ */

class KPIManager {
  constructor() {
    this._kpis = {
      asignado: document.querySelector('#kpi-asignado .kpi-value'),
      modificaciones: document.querySelector('#kpi-modificaciones .kpi-value'),
      actualizado: document.querySelector('#kpi-actualizado .kpi-value'),
      comprometido: document.querySelector('#kpi-comprometido .kpi-value'),
      causado: document.querySelector('#kpi-causado .kpi-value'),
      pagado: document.querySelector('#kpi-pagado .kpi-value'),
      ejecucionComp: document.querySelector('#kpi-ejec-comp .kpi-value'),
      ejecucionCaus: document.querySelector('#kpi-ejec-caus .kpi-value'),
      saldo: document.querySelector('#kpi-saldo .kpi-value')
    };
    this._animationFrames = {};
  }

  /**
   * Actualiza todos los KPIs con los datos filtrados
   * @param {Array<Array>} filteredRows - Filas filtradas
   */
  update(filteredRows) {
    const headers = filterManager.getHeaders();
    const colIdx = (name) => headers.indexOf(name);

    // ---- BUDGET FIELDS: Asignado siempre usa TODOS los datos (RAW) ---- //
    // Asignado es el presupuesto inicial fijo.
    const rawData = dataManager.getAllRaw();
    const rawHeaders = rawData.headers;
    const rawRows = window.filterManager ? window.filterManager.getStructurallyFilteredData() : rawData.rows;
    const rawColIdx = (name) => rawHeaders.indexOf(name);

    const asignadoRawIdx = rawColIdx('Asignado');
    const cuentaRawIdx = rawColIdx('Cuenta');
    const epRawIdx = rawColIdx('Estructura Programatica');
    const accRawIdx = rawColIdx('Accion Especifica');
    const uniRawIdx = rawColIdx('Unidad Ejecutora');

    let totalAsignado = 0;
    const blocksProcesados = {};

    rawRows.forEach(row => {
      const ep = String(row[epRawIdx] || '').trim();
      const accion = String(row[accRawIdx] || '').trim();
      const unidad = String(row[uniRawIdx] || '').trim();
      const cuenta = String(row[cuentaRawIdx] || '').trim();
      const blockId = `${ep}│${accion}│${unidad}│${cuenta}`;

      if (cuenta && ep) {
        if (!blocksProcesados[blockId]) {
          blocksProcesados[blockId] = { asignado: 0 };
        }
        blocksProcesados[blockId].asignado = Math.max(blocksProcesados[blockId].asignado, parseFloat(row[asignadoRawIdx]) || 0);
      }
    });

    for (const b in blocksProcesados) {
      totalAsignado += blocksProcesados[b].asignado;
    }

    // ---- EXECUTION FIELDS: usar datos filtrados (varían por mes) ---- //
    const aumIdx = colIdx('Aumento');
    const disIdx = colIdx('Disminucion');
    const compIdx = colIdx('Comprometido');
    const causIdx = colIdx('Causado');
    const pagIdx = colIdx('Pagado');

    let totalAumento = 0;
    let totalDisminucion = 0;
    let totalComprometido = 0;
    let totalCausado = 0;
    let totalPagado = 0;

    filteredRows.forEach(row => {
      totalAumento += parseFloat(row[aumIdx]) || 0;
      totalDisminucion += parseFloat(row[disIdx]) || 0;
      totalComprometido += parseFloat(row[compIdx]) || 0;
      totalCausado += parseFloat(row[causIdx]) || 0;
      totalPagado += parseFloat(row[pagIdx]) || 0;
    });

    const totalModificaciones = totalAumento - totalDisminucion;
    const totalActualizado = totalAsignado + totalModificaciones;

    const ejecucionComp = totalActualizado > 0 ? (totalComprometido / totalActualizado * 100) : 0;
    const ejecucionCaus = totalActualizado > 0 ? (totalCausado / totalActualizado * 100) : 0;
    const saldoPorEjecutar = totalActualizado - totalComprometido;

    // Animar cada KPI
    this._animateValue('asignado', totalAsignado, true);
    this._animateValue('modificaciones', totalModificaciones, true);
    this._animateValue('actualizado', totalActualizado, true);
    this._animateValue('comprometido', totalComprometido, true);
    this._animateValue('causado', totalCausado, true);
    this._animateValue('pagado', totalPagado, true);
    this._animatePercent('ejecucionComp', ejecucionComp);
    this._animatePercent('ejecucionCaus', ejecucionCaus);
    this._animateValue('saldo', saldoPorEjecutar, true);

    // Ejecución por Área
    this._updateAreas(filteredRows);
  }

  /**
   * Actualiza las barras de ejecución por área
   * @param {Array<Array>} rows - Filas filtradas
   * @private
   */
  _updateAreas(rows) {
    const headers = filterManager.getHeaders();
    const epIdx = headers.indexOf('Estructura Programatica');
    const pagIdx = headers.indexOf('Pagado');
    const cuentaIdx = headers.indexOf('Cuenta');
    if (epIdx < 0 || pagIdx < 0) return;

    // El Monto Actualizado (presupuesto) se calcula de TODOS los datos
    const rawData = dataManager.getAllRaw();
    const rawHeaders = rawData.headers;
    const rawRows = window.filterManager ? window.filterManager.getStructurallyFilteredData() : rawData.rows;
    const rawEpIdx = rawHeaders.indexOf('Estructura Programatica');
    const rawActIdx = rawHeaders.indexOf('Monto Actualizado');
    const rawBlockIdIdx = rawHeaders.indexOf('ID Bloque');
    if (rawEpIdx < 0 || rawActIdx < 0) return;

    const areas = ['AC1', 'AC2', 'AC3', 'PR1'];
    const totals = {};
    areas.forEach(a => totals[a] = { actualizado: 0, pagado: 0 });

    // Calcular presupuesto (actualizado) de TODOS los datos raw
    const processedBlocks = new Set();
    rawRows.forEach(row => {
      const ep = String(row[rawEpIdx] || '').trim();
      const area = areas.find(a => ep.startsWith(a));
      if (!area) return;
      const blockId = String(row[rawBlockIdIdx] || '').trim();
      
      // La clave compuesta ya no es necesaria si usamos blockId, pero por robustez:
      if (blockId && !processedBlocks.has(blockId)) {
        processedBlocks.add(blockId);
        totals[area].actualizado += parseFloat(row[rawActIdx]) || 0;
      }
    });

    // Calcular pagado de los datos FILTRADOS
    rows.forEach(row => {
      const ep = String(row[epIdx] || '').trim();
      const area = areas.find(a => ep.startsWith(a));
      if (!area) return;
      totals[area].pagado += parseFloat(row[pagIdx]) || 0;
    });

    areas.forEach(area => {
      const { actualizado, pagado } = totals[area];
      const pct = actualizado > 0 ? (pagado / actualizado * 100) : 0;
      const rowEl = document.querySelector(`.kpi-area-row[data-area="${area}"]`);
      if (!rowEl) return;
      const fill = rowEl.querySelector('.kpi-area-fill');
      const pctEl = rowEl.querySelector('.kpi-area-pct');
      if (fill) fill.style.width = `${Math.min(pct, 100)}%`;
      if (pctEl) pctEl.textContent = pct.toFixed(1) + '%';
    });
  }

  /**
   * Parsea fecha DD/MM/YYYY a Date
   * @param {string} str
   * @returns {Date|null}
   * @private
   */
  _parseDate(str) {
    if (!str) return null;
    const parts = str.split('/');
    if (parts.length !== 3) return null;
    const d = new Date(parts[2], parts[1] - 1, parts[0]);
    return isNaN(d.getTime()) ? null : d;
  }

  /**
   * Anima un valor numérico con formato de moneda
   * @param {string} key - Clave del KPI
   * @param {number} target - Valor objetivo
   * @param {boolean} currency - Si es formato moneda
   * @private
   */
  _animateValue(key, target, currency = false) {
    const el = this._kpis[key];
    if (!el) return;

    // Cancelar animación previa
    if (this._animationFrames[key]) {
      cancelAnimationFrame(this._animationFrames[key]);
    }

    const start = parseFloat(el.dataset.current || '0') || 0;
    const duration = 1200;
    const startTime = performance.now();

    const animate = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = start + (target - start) * eased;

      el.textContent = currency ? this._formatCurrency(current) : current.toFixed(0);
      el.dataset.current = current;

      if (progress < 1) {
        this._animationFrames[key] = requestAnimationFrame(animate);
      } else {
        el.textContent = currency ? this._formatCurrency(target) : target.toFixed(0);
        el.dataset.current = target;
      }
    };

    this._animationFrames[key] = requestAnimationFrame(animate);
  }

  /**
   * Anima un porcentaje
   * @param {string} key
   * @param {number} target
   * @private
   */
  _animatePercent(key, target) {
    const el = this._kpis[key];
    if (!el) return;

    if (this._animationFrames[key]) {
      cancelAnimationFrame(this._animationFrames[key]);
    }

    const start = parseFloat(el.dataset.current || '0') || 0;
    const duration = 1200;
    const startTime = performance.now();

    const animate = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = start + (target - start) * eased;

      el.textContent = current.toFixed(1) + '%';
      el.dataset.current = current;

      if (progress < 1) {
        this._animationFrames[key] = requestAnimationFrame(animate);
      } else {
        el.textContent = target.toFixed(1) + '%';
        el.dataset.current = target;
      }
    };

    this._animationFrames[key] = requestAnimationFrame(animate);
  }

  /**
   * Anima un entero
   * @param {string} key
   * @param {number} target
   * @private
   */
  _animateInteger(key, target) {
    const el = this._kpis[key];
    if (!el) return;

    if (this._animationFrames[key]) {
      cancelAnimationFrame(this._animationFrames[key]);
    }

    const start = parseFloat(el.dataset.current || '0') || 0;
    const duration = 1000;
    const startTime = performance.now();

    const animate = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(start + (target - start) * eased);

      el.textContent = current.toLocaleString('es-VE');
      el.dataset.current = current;

      if (progress < 1) {
        this._animationFrames[key] = requestAnimationFrame(animate);
      } else {
        el.textContent = target.toLocaleString('es-VE');
        el.dataset.current = target;
      }
    };

    this._animationFrames[key] = requestAnimationFrame(animate);
  }

  /**
   * Formatea un número como moneda sin abreviaturas
   * @param {number} value
   * @returns {string}
   * @private
   */
  _formatCurrency(value) {
    return value.toLocaleString('es-VE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }
}

const kpiManager = new KPIManager();
window.kpiManager = kpiManager;
