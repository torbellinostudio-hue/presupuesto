/* ================================================================
   AGGREGATOR-UI.JS — Renderiza las vistas de datos unificados
   ================================================================
   Gestiona tabs, tablas con paginación local, búsqueda y
   exportación de cada resumen de agregación.
   ================================================================ */

class AggregatorUI {
    constructor() {
        this._currentTab = 'byPartida';
        this._pageSize = 15;
        this._pages = {};
        this._searchTerms = {};
        this._aggregations = null;
    }

    /**
     * Renderiza todas las vistas de agregación en el DOM
     * @param {Object} aggregations - Resultado de dataAggregator.computeAll()
     */
    render(aggregations) {
        this._aggregations = aggregations;
        if (!aggregations || Object.keys(aggregations).length === 0) return;

        const section = document.getElementById('aggregation-section');
        if (!section) return;
        section.classList.remove('hidden');

        // Renderizar barra de totales globales
        this._renderTotalsBar(aggregations.grandTotals);


        // Renderizar tabs
        this._renderTabs(aggregations);

        // Activar tab actual (mantiene la vista cuando cambian los filtros)
        this._activateTab(this._currentTab);
    }



    /**
     * Renderiza la barra de totales globales
     * @param {Object} totals
     * @private
     */
    _renderTotalsBar(totals) {
        const container = document.getElementById('aggregation-totals');
        if (!container || !totals) return;

        const items = [
            { label: 'Total Asignado', field: 'Asignado', cls: 'total-primary' },
            { label: 'Monto Actualizado', field: 'Monto Actualizado', cls: 'total-primary' },
            { label: 'Total Comprometido', field: 'Comprometido', cls: 'total-warning' },
            { label: 'Total Pagado', field: 'Pagado', cls: 'total-success' },
            { label: 'Disponible', field: 'Disponible', cls: 'total-danger' }
        ];

        container.innerHTML = items.map(item => `
      <div class="summary-total-item ${item.cls}">
        <div class="total-label">${item.label}</div>
        <div class="total-value">${this._fmt(totals[item.field] || 0)}</div>
      </div>
    `).join('');
    }

    /**
     * Renderiza los tabs de navegación
     * @param {Object} aggregations
     * @private
     */
    _renderTabs(aggregations) {
        const container = document.getElementById('aggregation-tabs');
        if (!container) return;

        const tabConfig = [
            { id: 'byPartida', label: '📂 Por Partida', count: aggregations.byPartida?.length },
            { id: 'byEstructura', label: '🏛️ Por Estructura', count: aggregations.byEstructura?.length },
            { id: 'matrixEPPartida', label: '📊 Matriz EP×Partida', count: aggregations.matrixEPPartida?.length },
            { id: 'byGenerica', label: '📁 Por Genérica', count: aggregations.byGenerica?.length },
            { id: 'byEspecifica', label: '📄 Por Específica', count: aggregations.byEspecifica?.length },
            { id: 'byAccion', label: '🎯 Por Acción', count: aggregations.byAccion?.length }
        ];

        container.innerHTML = tabConfig
            .filter(t => t.count > 0)
            .map(t => `
        <button class="aggregation-tab" data-tab="${t.id}" data-count="${t.count}">
          ${t.label}
          <span class="tab-badge">${t.count}</span>
        </button>
      `).join('') + `
        <button class="aggregation-tab" data-tab="grandTotals">
          📋 Totales Globales
        </button>
      `;

        // Bind events
        container.querySelectorAll('.aggregation-tab').forEach(btn => {
            btn.addEventListener('click', () => this._activateTab(btn.dataset.tab));
        });
    }

    /**
     * Activa un tab y renderiza su contenido
     * @param {string} tabId
     * @private
     */
    _activateTab(tabId) {
        this._currentTab = tabId;

        // Actualizar tabs
        const container = document.getElementById('aggregation-tabs');
        container.querySelectorAll('.aggregation-tab').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabId);
        });

        // Ocultar todos los paneles
        document.querySelectorAll('.aggregation-panel').forEach(p => p.classList.remove('active'));

        let panel = document.getElementById(`panel-${tabId}`);

        if (tabId === 'grandTotals') {
            this._renderGrandTotalsPanel();
            return;
        }

        if (!panel) {
            panel = this._createPanel(tabId);
        }

        panel.classList.add('active');

        // Renderizar datos siempre que se active el tab (los filtros pudieron haber cambiado)
        const tbody = panel.querySelector('.aggregation-table tbody');
        if (tbody) {
            this._renderTableData(panel, tabId);
        }
    }

    /**
     * Crea un panel para un tab
     * @param {string} tabId
     * @returns {HTMLElement}
     * @private
     */
    _createPanel(tabId) {
        const section = document.getElementById('aggregation-panels');
        const panel = document.createElement('div');
        panel.className = 'aggregation-panel';
        panel.id = `panel-${tabId}`;

        // Determinar columnas según el tab
        const config = this._getColumnConfig(tabId);
        const data = this._aggregations[tabId] || [];

        panel.innerHTML = `
      <div class="aggregation-panel-header">
        <div class="aggregation-panel-title">
          ${config.icon} ${config.title}
          <span style="font-size:var(--font-size-xs);color:var(--color-text-muted);font-weight:normal;">
            (${data.length} registros)
          </span>
        </div>
        <div class="aggregation-panel-actions">
          <input type="text" class="aggregation-search" placeholder="🔍 Buscar en ${config.searchPlaceholder}..." data-tab="${tabId}">
          <button class="btn btn-ghost btn-small btn-export-summary" data-tab="${tabId}">
            📥 Exportar CSV
          </button>
        </div>
      </div>
      <div class="aggregation-table-wrapper">
        <table class="aggregation-table">
          <thead>
            <tr>${config.columns.map(c => `<th class="${c.cls || ''}" data-field="${c.field}">${c.label}</th>`).join('')}</tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
      <div class="aggregation-pagination" id="pagination-${tabId}"></div>
    `;

        section.appendChild(panel);

        // Bind search
        const searchInput = panel.querySelector('.aggregation-search');
        let searchTimer;
        searchInput.addEventListener('input', () => {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(() => {
                this._searchTerms[tabId] = searchInput.value.trim().toLowerCase();
                this._pages[tabId] = 1;
                this._renderTableData(panel, tabId);
            }, 300);
        });

        // Bind export
        panel.querySelector('.btn-export-summary').addEventListener('click', () => {
            const filename = `resumen_${tabId}_${new Date().toISOString().slice(0, 10)}.csv`;
            DataAggregator.exportToCSV(data, filename);
        });

        // Bind column sort
        panel.querySelectorAll('.aggregation-table th').forEach(th => {
            th.addEventListener('click', () => {
                const field = th.dataset.field;
                if (!field) return;
                this._sortData(tabId, field);
                this._renderTableData(panel, tabId);
            });
        });

        return panel;
    }

    /**
     * Renderiza los datos en la tabla de un panel
     * @param {HTMLElement} panel
     * @param {string} tabId
     * @private
     */
    _renderTableData(panel, tabId) {
        const config = this._getColumnConfig(tabId);
        let data = this._aggregations[tabId] || [];

        // Aplicar búsqueda
        const searchTerm = this._searchTerms[tabId] || '';
        if (searchTerm) {
            data = DataAggregator.filterSummary(data, searchTerm);
        }

        // Aplicar ordenación
        if (this._sortState && this._sortState.tab === tabId) {
            const { field, asc } = this._sortState;
            data = [...data].sort((a, b) => {
                const va = parseFloat(a[field]) || 0;
                const vb = parseFloat(b[field]) || 0;
                return asc ? va - vb : vb - va;
            });
        }

        // Paginación
        const totalItems = data.length;
        const totalPages = Math.max(1, Math.ceil(totalItems / this._pageSize));
        const currentPage = Math.min(this._pages[tabId] || 1, totalPages);
        this._pages[tabId] = currentPage;

        const start = (currentPage - 1) * this._pageSize;
        const pageData = data.slice(start, start + this._pageSize);

        // Renderizar filas
        const tbody = panel.querySelector('.aggregation-table tbody');
        const keyField = config.columns[0].field;

        tbody.innerHTML = pageData.map(item => {
            const key = item[keyField] || '';
            // Truncar strings largos
            const displayKey = String(key).length > 55 ? String(key).slice(0, 53) + '…' : key;

            const cells = config.columns.map(col => {
                const val = item[col.field];
                if (col.field === keyField) {
                    return `<td>${displayKey}</td>`;
                }

                if (typeof val === 'number') {
                    let cls = '';
                    // Color coding
                    if (col.field === 'Disponible' || col.field === 'Saldo por Ejecutar') {
                        cls = val < 0 ? 'num-negative' : val === 0 ? '' : 'num-positive';
                    } else if (col.field === '% Ejecucion' || col.field === '% Comprometido') {
                        cls = 'num-primary';
                    }

                    if (col.field === '% Ejecucion' || col.field === '% Comprometido') {
                        // Renderizar barra de progreso para porcentajes
                        const barCls = val >= 80 ? 'bar-green' : val >= 50 ? 'bar-blue' : val >= 25 ? 'bar-orange' : 'bar-red';
                        return `<td>
              <div class="bar-cell">
                <span class="${cls}">${val.toFixed(1)}%</span>
                <div class="bar-track">
                  <div class="bar-fill ${barCls}" style="width:${Math.min(val, 100)}%"></div>
                </div>
              </div>
            </td>`;
                    }

                    return `<td class="${cls}">${this._fmt(val)}</td>`;
                }

                return `<td>${val || ''}</td>`;
            });

            return `<tr>${cells.join('')}</tr>`;
        }).join('');

        // Calcular totales para el pie
        const totalsRow = this._computeTotalsRow(data, config);
        if (totalsRow && data.length > 1) {
            tbody.innerHTML += `<tr class="grand-total">${totalsRow}</tr>`;
        }

        // Renderizar paginación
        this._renderPagination(panel, tabId, currentPage, totalPages, totalItems);
    }

    /**
     * Computa la fila de totales para una vista
     * @param {Array} data
     * @param {Object} config
     * @returns {string|null}
     * @private
     */
    _computeTotalsRow(data, config) {
        if (!data || data.length === 0) return null;

        return config.columns.map(col => {
            if (col.field === config.columns[0].field) {
                return '<td><strong>TOTAL</strong></td>';
            }
            // Solo sumar campos numéricos que no sean porcentajes
            if (col.field === '% Ejecucion' || col.field === '% Comprometido') {
                return '<td></td>';
            }
            const total = data.reduce((s, item) => s + (parseFloat(item[col.field]) || 0), 0);
            return `<td><strong>${this._fmt(total)}</strong></td>`;
        }).join('');
    }

    /**
     * Renderiza la paginación
     * @param {HTMLElement} panel
     * @param {string} tabId
     * @param {number} current
     * @param {number} total
     * @param {number} totalItems
     * @private
     */
    _renderPagination(panel, tabId, current, total, totalItems) {
        const pag = panel.querySelector('.aggregation-pagination');
        if (!pag) return;

        if (total <= 1) {
            pag.innerHTML = `<span class="page-info">${totalItems} registro(s)</span>`;
            return;
        }

        pag.innerHTML = `
      <button class="page-btn" data-action="prev" ${current <= 1 ? 'disabled' : ''}>‹ Anterior</button>
      <span class="page-info">Pág. ${current} de ${total} (${totalItems} registros)</span>
      <button class="page-btn" data-action="next" ${current >= total ? 'disabled' : ''}>Siguiente ›</button>
    `;

        pag.querySelectorAll('.page-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.dataset.action;
                if (action === 'prev' && current > 1) {
                    this._pages[tabId] = current - 1;
                } else if (action === 'next' && current < total) {
                    this._pages[tabId] = current + 1;
                } else {
                    return;
                }
                this._renderTableData(panel, tabId);
            });
        });
    }

    /**
     * Renderiza el panel de Totales Globales
     * @private
     */
    _renderGrandTotalsPanel() {
        const totals = this._aggregations.grandTotals;
        if (!totals) return;

        let panel = document.getElementById('panel-grandTotals');
        if (!panel) {
            const section = document.getElementById('aggregation-panels');
            panel = document.createElement('div');
            panel.className = 'aggregation-panel';
            panel.id = 'panel-grandTotals';
            panel.innerHTML = `
        <div class="aggregation-panel-header">
          <div class="aggregation-panel-title">📋 Totales Globales Consolidados</div>
        </div>
        <div class="aggregation-table-wrapper">
          <table class="aggregation-table">
            <thead>
              <tr>
                <th class="label-col">Indicador</th>
                <th>Valor</th>
                <th>Descripción</th>
              </tr>
            </thead>
            <tbody></tbody>
          </table>
        </div>
      `;
            section.appendChild(panel);
        }

        const tbody = panel.querySelector('.aggregation-table tbody');
        const meta = this._aggregations.metadata || {};

        const rows = [
            { label: 'Total Asignado', value: totals.Asignado, desc: 'Presupuesto original asignado' },
            { label: 'Aumento', value: totals.Aumento, desc: 'Incrementos al presupuesto' },
            { label: 'Disminución', value: totals.Disminucion, desc: 'Reducciones al presupuesto' },
            { label: 'Modificación Neta', value: totals.Modificación, desc: 'Aumento - Disminución' },
            { label: 'Monto Actualizado', value: totals['Monto Actualizado'], desc: 'Presupuesto vigente' },
            { label: 'Pre Comprometido', value: totals['Pre Comprometido'], desc: 'Reservas preventivas' },
            { label: 'Comprometido', value: totals.Comprometido, desc: 'Obligaciones contraídas' },
            { label: 'Causado', value: totals.Causado, desc: 'Devengado / derechos reconocidos' },
            { label: 'Pagado', value: totals.Pagado, desc: 'Ejecutado en efectivo' },
            { label: 'Por Pagar', value: totals['Por Pagar'], desc: 'Comprometido - Pagado' },
            { label: 'Disponible', value: totals.Disponible, desc: 'Monto Actualizado - Comprometido' }
        ];

        tbody.innerHTML = rows.map(r => {
            const valCls = r.label === 'Disponible' ? (r.value < 0 ? 'num-negative' : 'num-positive') : '';
            return `<tr>
        <td style="font-weight:var(--font-weight-semibold)">${r.label}</td>
        <td class="${valCls}" style="font-weight:var(--font-weight-bold)">${this._fmt(r.value)}</td>
        <td style="color:var(--color-text-light);font-size:var(--font-size-xs)">${r.desc}</td>
      </tr>`;
        }).join('');

        // Metadata
        if (meta.totalRawRows) {
            const metaRow = document.createElement('tr');
            metaRow.style.cssText = 'border-top:2px solid var(--color-border);background:var(--color-bg-elevated);';
            metaRow.innerHTML = `
        <td colspan="3" style="padding:0.75rem;font-size:var(--font-size-xs);color:var(--color-text-muted);text-align:center;">
          📊 ${meta.totalRawRows.toLocaleString()} transacciones procesadas ·
          ${(meta.totalPartidas || 0).toLocaleString()} partidas ·
          ${(meta.totalEstructuras || 0).toLocaleString()} estructuras ·
          ${(meta.totalAcciones || 0).toLocaleString()} acciones ·
          ${(meta.totalProveedores || 0).toLocaleString()} proveedores
        </td>
      `;
            tbody.appendChild(metaRow);
        }

        panel.classList.add('active');
    }

    /**
     * Ordena los datos por un campo
     * @param {string} tabId
     * @param {string} field
     * @private
     */
    _sortData(tabId, field) {
        const prev = this._sortState;
        if (prev && prev.tab === tabId && prev.field === field) {
            this._sortState = { tab: tabId, field, asc: !prev.asc };
        } else {
            this._sortState = { tab: tabId, field, asc: false };
        }
    }

    /**
     * Configuración de columnas para cada tipo de resumen
     * @param {string} tabId
     * @returns {Object}
     * @private
     */
    _getColumnConfig(tabId) {
        const configs = {
            byPartida: {
                icon: '📂',
                title: 'Resumen por Partida',
                searchPlaceholder: 'partidas',
                columns: [
                    { field: 'Partida', label: 'Partida', cls: 'label-col' },
                    { field: 'Denominacion', label: 'Denominación' },
                    { field: 'Asignado', label: 'Asignado' },
                    { field: 'Modificación', label: 'Modificación' },
                    { field: 'Monto Actualizado', label: 'Monto Actualizado' },
                    { field: 'Comprometido', label: 'Comprometido' },
                    { field: 'Causado', label: 'Causado' },
                    { field: 'Pagado', label: 'Pagado' },
                    { field: 'Disponible', label: 'Disponible' },
                    { field: '% Ejecucion', label: '% Ejec' }
                ]
            },
            byEstructura: {
                icon: '🏛️',
                title: 'Resumen por Estructura Programática',
                searchPlaceholder: 'estructuras',
                columns: [
                    { field: 'Estructura Programatica', label: 'Estructura Programática', cls: 'label-col' },
                    { field: 'Asignado', label: 'Asignado' },
                    { field: 'Modificación', label: 'Modificación' },
                    { field: 'Monto Actualizado', label: 'Monto Actualizado' },
                    { field: 'Comprometido', label: 'Comprometido' },
                    { field: 'Causado', label: 'Causado' },
                    { field: 'Pagado', label: 'Pagado' },
                    { field: 'Disponible', label: 'Disponible' },
                    { field: '% Ejecucion', label: '% Ejec' }
                ]
            },
            matrixEPPartida: {
                icon: '📊',
                title: 'Matriz Estructura Programática × Partida',
                searchPlaceholder: 'estructura o partida',
                columns: [
                    { field: 'EstructuraProgramatica', label: 'Estructura Programática', cls: 'label-col' },
                    { field: 'Partida', label: 'Partida' },
                    { field: 'Denominacion', label: 'Denominación' },
                    { field: 'Monto Actualizado', label: 'Monto Actualizado' },
                    { field: 'Comprometido', label: 'Comprometido' },
                    { field: 'Pagado', label: 'Pagado' },
                    { field: 'Disponible', label: 'Disponible' },
                    { field: '% Ejecucion', label: '% Ejec' }
                ]
            },
            byGenerica: {
                icon: '📁',
                title: 'Resumen por Partida Genérica',
                searchPlaceholder: 'genéricas',
                columns: [
                    { field: 'Generica', label: 'Genérica', cls: 'label-col' },
                    { field: 'Denominacion', label: 'Denominación' },
                    { field: 'Asignado', label: 'Asignado' },
                    { field: 'Monto Actualizado', label: 'Monto Actualizado' },
                    { field: 'Comprometido', label: 'Comprometido' },
                    { field: 'Pagado', label: 'Pagado' },
                    { field: 'Disponible', label: 'Disponible' },
                    { field: '% Ejecucion', label: '% Ejec' }
                ]
            },
            byEspecifica: {
                icon: '📄',
                title: 'Resumen por Partida Específica',
                searchPlaceholder: 'específicas',
                columns: [
                    { field: 'Especifica', label: 'Específica', cls: 'label-col' },
                    { field: 'Denominacion', label: 'Denominación' },
                    { field: 'Monto Actualizado', label: 'Monto Actualizado' },
                    { field: 'Comprometido', label: 'Comprometido' },
                    { field: 'Pagado', label: 'Pagado' },
                    { field: 'Disponible', label: 'Disponible' },
                    { field: '% Ejecucion', label: '% Ejec' }
                ]
            },
            byAccion: {
                icon: '🎯',
                title: 'Resumen por Acción Específica',
                searchPlaceholder: 'acciones',
                columns: [
                    { field: 'Accion Especifica', label: 'Acción Específica', cls: 'label-col' },
                    { field: 'Monto Actualizado', label: 'Monto Actualizado' },
                    { field: 'Comprometido', label: 'Comprometido' },
                    { field: 'Pagado', label: 'Pagado' },
                    { field: 'Disponible', label: 'Disponible' },
                    { field: '% Ejecucion', label: '% Ejec' }
                ]
            }
        };

        // Para matrix, el key compuesto usa 'EstructuraProgramatica'
        if (tabId === 'matrixEPPartida') {
            configs.matrixEPPartida.columns[0].field = 'EstructuraProgramatica';
        }

        return configs[tabId] || configs.byPartida;
    }

    /**
     * Formatea número como moneda
     * @param {number} v
     * @returns {string}
     * @private
     */
    _fmt(v) {
        if (v === 0 || v === null || v === undefined) return '0,00';
        return Number(v).toLocaleString('es-VE', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    /**
     * Limpia el estado
     */
    reset() {
        this._currentTab = 'byPartida';
        this._pages = {};
        this._searchTerms = {};
        this._aggregations = null;
        this._sortState = null;

        // Limpiar DOM
        const section = document.getElementById('aggregation-section');
        if (section) section.classList.add('hidden');

        const panels = document.getElementById('aggregation-panels');
        if (panels) panels.innerHTML = '';

        const tabs = document.getElementById('aggregation-tabs');
        if (tabs) tabs.innerHTML = '';

        const totals = document.getElementById('aggregation-totals');
        if (totals) totals.innerHTML = '';

        // Limpiar badge de mes
        const header = document.querySelector('.aggregation-header');
        if (header) {
            const badge = header.querySelector('.month-context-badge');
            if (badge) badge.remove();
        }
    }
}

// Instancia global
const aggregatorUI = new AggregatorUI();
window.aggregatorUI = aggregatorUI;
