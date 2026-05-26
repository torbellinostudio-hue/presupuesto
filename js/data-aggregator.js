/* ================================================================
   DATA-AGGREGATOR.JS — Motor de Unificación y Agregación
   ================================================================
   Transforma datos transaccionales brutos en resúmenes
   jerárquicos utilizando claves: Partida, Estructura Programática,
   Genérica, Específica, Acción, Proveedor, etc.

   Flujo conceptual:
     Datos raw → Agrupar por clave(s) jerárquica(s) →
     Sumarizar campos numéricos → Calcular derivados →
     Presentar en tablas resumen y alimentar dashboards
   ================================================================ */

class DataAggregator {
    constructor() {
        /** Nombres de campos numéricos que se sumarizan */
        this._numericFields = [
            'Asignado', 'Aumento', 'Disminucion', 'Modificación',
            'Monto Actualizado', 'Pre Comprometido', 'Comprometido',
            'Causado', 'Pagado', 'Por Pagar'
        ];

        /** Nombres de campos que son "una vez por cuenta" (no sumables) */
        this._oncePerCuenta = ['Monto Actualizado', 'Asignado', 'Pre Comprometido'];

        /** Nombres de campos de ejecución (varían por mes) */
        this._executionFields = ['Aumento', 'Disminucion', 'Comprometido', 'Causado', 'Pagado', 'Por Pagar'];

        /** Cache de últimos resultados de agregación */
        this._cache = {};
    }

    /**
     * Punto de entrada principal: ejecuta TODAS las agregaciones
     * y devuelve un objeto con todas las vistas pre-calculadas.
     *
     * IMPORTANTE: Los campos presupuestarios (Asignado, Monto Actualizado, etc.)
     * se calculan desde TODOS los datos raw (no filtrados), mientras que los
     * campos de ejecución (Comprometido, Pagado, etc.) se calculan desde las
     * filas filtradas. Esto asegura que el presupuesto asignado no varíe
     * al cambiar el filtro de mes.
     *
     * @param {Array<Array>} rows - Datos filtrados (array de arrays)
     * @param {string[]} headers - Nombres de columnas
     * @returns {Object} Todas las vistas de agregación
     */
    computeAll(rows, headers) {
        if (!rows || rows.length === 0) return {};

        const idx = (name) => headers.indexOf(name);

        this._headers = headers;
        this._idx = {
            ep: idx('Estructura Programatica'),
            accion: idx('Accion Especifica'),
            unidad: idx('Unidad Ejecutora'),
            partida: idx('Partida'),
            generica: idx('Generica'),
            especifica: idx('Especifica'),
            subespec: idx('Sub-especifica'),
            cuenta: idx('Cuenta'),
            denom: idx('Denominacion'),
            proveedor: idx('Proveedor/Beneficiario'),
            asignado: idx('Asignado'),
            aumento: idx('Aumento'),
            disminucion: idx('Disminucion'),
            modificacion: idx('Modificación'),
            montoAct: idx('Monto Actualizado'),
            preComp: idx('Pre Comprometido'),
            comp: idx('Comprometido'),
            causado: idx('Causado'),
            pagado: idx('Pagado'),
            porPagar: idx('Por Pagar'),
            blockId: idx('ID Bloque')
        };

        // Cache basado en la cantidad de filas para invalidación rápida
        const cacheKey = `${rows.length}-${rows[0]?.length}`;
        if (this._cache[cacheKey]) return this._cache[cacheKey];

        // ================================================================
        //  PASO 1: Construir grupos desde TODOS los datos RAW
        //  Esto asegura que TODAS las partidas/estructuras/cuentas estén
        //  presentes y que los campos presupuestarios (Asignado, Monto
        //  Actualizado, etc.) reflejen el presupuesto completo del año,
        //  SIN importar el filtro de mes activo.
        // ================================================================
        const rawData = dataManager.getAllRaw();
        const rawRows = window.filterManager ? window.filterManager.getStructurallyFilteredData() : rawData.rows;

        // Construir grupos desde RAW data (presupuesto completo)
        const groupsByPartida = this._groupBy(rawRows, 'partida');
        const groupsByEstructura = this._groupBy(rawRows, 'ep');
        const groupsByGenerica = this._groupBy(rawRows, 'generica');
        const groupsByEspecifica = this._groupBy(rawRows, 'especifica');
        const groupsBySubEspecifica = this._groupBy(rawRows, 'subespec');
        const groupsByAccion = this._groupBy(rawRows, 'accion');
        const groupsByDenom = this._groupBy(rawRows, 'denom');

        // ================================================================
        //  PASO 2: Sobreescribir campos de ejecución desde datos FILTRADOS
        //  Los campos Comprometido, Causado, Pagado, Por Pagar se
        //  recalculan SOLO con las filas del período seleccionado.
        // ================================================================
        this._overlayExecutionOnGroups(groupsByPartida, rows, 'partida');
        this._overlayExecutionOnGroups(groupsByEstructura, rows, 'ep');
        this._overlayExecutionOnGroups(groupsByGenerica, rows, 'generica');
        this._overlayExecutionOnGroups(groupsByEspecifica, rows, 'especifica');
        this._overlayExecutionOnGroups(groupsBySubEspecifica, rows, 'subespec');
        this._overlayExecutionOnGroups(groupsByAccion, rows, 'accion');
        this._overlayExecutionOnGroups(groupsByDenom, rows, 'denom');

        const result = {
            // Vistas principales (3 del plan maestro)
            byPartida: this._toSortedArray(groupsByPartida, 'Partida', true),
            byEstructura: this._toSortedArray(groupsByEstructura, 'Estructura Programatica', true),
            matrixEPPartida: this._aggregateMatrixEPPartida(rows),

            // Vistas adicionales jerárquicas
            byGenerica: this._toSortedArray(groupsByGenerica, 'Generica', true),
            byEspecifica: this._toSortedArray(groupsByEspecifica, 'Especifica', true),
            bySubEspecifica: this._toSortedArray(groupsBySubEspecifica, 'Sub-especifica', true),
            byAccion: this._toSortedArray(groupsByAccion, 'Accion Especifica', true),
            byDenominacion: this._toSortedArray(groupsByDenom, 'Denominacion', true),

            // Totales globales
            grandTotals: this._computeGrandTotals(rawRows, rows),

            // Metadatos de la agregación
            metadata: {
                totalRawRows: rawRows.length,
                totalPartidas: new Set(rawRows.map(r => r[this._idx.partida])).size,
                totalEstructuras: new Set(rawRows.map(r => r[this._idx.ep])).size,
                totalAcciones: new Set(rawRows.map(r => r[this._idx.accion])).size,
                totalDenominaciones: new Set(rawRows.map(r => r[this._idx.denom])).size,
            }
        };

        this._cache[cacheKey] = result;
        return result;
    }

    /**
     * Sobreescribe los campos de ejecución en grupos pre-construidos
     * usando SOLO las filas filtradas. Los campos presupuestarios
     * (Asignado, Monto Actualizado, etc.) NO se modifican.
     *
     * @param {Map} groups - Mapa de grupos (key → group object) construido desde RAW data
     * @param {Array<Array>} filteredRows - Filas filtradas para calcular ejecución
     * @param {string} keyName - Nombre de la clave ('partida', 'ep', etc.)
     * @private
     */
    _overlayExecutionOnGroups(groups, filteredRows, keyName) {
        const execFields = this._executionFields;
        const idx = this._idx;

        const keyConfig = {
            partida: { getKey: (row) => String(row[idx.partida] || '').trim() },
            ep: { getKey: (row) => String(row[idx.ep] || '').trim() },
            unidad: { getKey: (row) => String(row[idx.unidad] || '').trim() },
            generica: { getKey: (row) => String(row[idx.generica] || '').trim() },
            especifica: { getKey: (row) => String(row[idx.especifica] || '').trim() },
            subespec: { getKey: (row) => String(row[idx.subespec] || '').trim() },
            accion: { getKey: (row) => String(row[idx.accion] || '').trim() },
            denom: { getKey: (row) => String(row[idx.denom] || '').trim() }
        };

        const cfg = keyConfig[keyName];
        if (!cfg) return;

        // Resetear campos de ejecución a 0 en todos los grupos
        for (const [, g] of groups) {
            execFields.forEach(f => g[f] = 0);
        }

        // Re-acumular ejecución SOLO desde las filas filtradas
        filteredRows.forEach(row => {
            const key = cfg.getKey(row);
            if (!key) return;
            const g = groups.get(key);
            if (!g) return;
            g['Aumento'] += parseFloat(row[idx.aumento]) || 0;
            g['Disminucion'] += parseFloat(row[idx.disminucion]) || 0;
            g['Comprometido'] += parseFloat(row[idx.comp]) || 0;
            g['Causado'] += parseFloat(row[idx.causado]) || 0;
            g['Pagado'] += parseFloat(row[idx.pagado]) || 0;
            g['Por Pagar'] += parseFloat(row[idx.porPagar]) || 0;
        });

        // Recalcular Modificación para cada grupo
        for (const [, g] of groups) {
            g['Modificación'] = g['Aumento'] - g['Disminucion'];
        }
    }

    /**
     * Invalida el cache (llamar cuando los datos cambien)
     */
    invalidateCache() {
        this._cache = {};
    }

    /**
     * Compara dos códigos presupuestarios jerárquicamente por segmentos.
     * Ej: "4.10.00" > "4.02.00" correctamente.
     * También da prioridad a las Acciones sobre los Proyectos en Estructura Programática.
     * @param {string} a
     * @param {string} b
     * @returns {number} negativo si a < b, positivo si a > b, 0 si igual
     */
    static _compareHierarchical(a, b) {
        const aStr = String(a || '').toUpperCase().trim();
        const bStr = String(b || '').toUpperCase().trim();

        // Prioridad en Estructura: Proyectos (ej: PR1) van después de Acciones (ej: AC1 o numéricos)
        const aIsProject = aStr.startsWith('PR') || aStr.includes('PROYECTO');
        const bIsProject = bStr.startsWith('PR') || bStr.includes('PROYECTO');

        if (aIsProject && !bIsProject) return 1;  // Acciones (b) primero
        if (!aIsProject && bIsProject) return -1; // Acciones (a) primero

        const partsA = aStr.split(/[.\-]/);
        const partsB = bStr.split(/[.\-]/);
        const len = Math.max(partsA.length, partsB.length);

        for (let i = 0; i < len; i++) {
            const pA = partsA[i] || '';
            const pB = partsB[i] || '';

            // Intentar extraer números al inicio del segmento
            const matchA = pA.match(/^(\d+)/);
            const matchB = pB.match(/^(\d+)/);

            if (matchA && matchB) {
                const numA = parseInt(matchA[1], 10);
                const numB = parseInt(matchB[1], 10);
                if (numA !== numB) return numA - numB;

                // Si la parte numérica es igual (ej: 1A vs 1B), comparamos el resto
                const restA = pA.substring(matchA[1].length);
                const restB = pB.substring(matchB[1].length);
                const cmp = restA.localeCompare(restB);
                if (cmp !== 0) return cmp;
            } else if (matchA && !matchB) {
                return -1; // Números primero
            } else if (!matchA && matchB) {
                return 1;
            } else {
                // Ambos son texto puro
                const cmp = pA.localeCompare(pB);
                if (cmp !== 0) return cmp;
            }
        }
        return 0;
    }

    // ================================================================
    //  1. RESUMEN POR PARTIDA
    //     Agrupa por código de Partida (completo: 4.01.00.00.00)
    //     Orden jerárquico ascendente: 4.01, 4.02, 4.03...
    //     Muestra: Asignado, Modificación, Monto Actualizado,
    //              Comprometido, Causado, Pagado, Disponible
    // ================================================================
    _aggregateByPartida(rows) {
        const groups = this._groupBy(rows, 'partida');
        return this._toSortedArray(groups, 'Partida', true);
    }

    // ================================================================
    //  2. RESUMEN POR ESTRUCTURA PROGRAMÁTICA
    //     Agrupa por EP (AC1, AC2, AC3, PR1...)
    //     Orden: acciones primero (AC1, AC2, AC3), luego proyectos (PR1)
    // ================================================================
    _aggregateByEstructura(rows) {
        const groups = this._groupBy(rows, 'ep');
        return this._toSortedArray(groups, 'Estructura Programatica', true);
    }

    // ================================================================
    //  3. MATRIZ ESTRUCTURA × PARTIDA (PIVOT TABLE)
    //     Cruza EP vs Partida. Cada celda es un resumen completo.
    //     Orden: por EP jerárquico, luego por Partida jerárquico
    //     Presupuesto desde RAW data, ejecución desde filteredRows
    // ================================================================
    _aggregateMatrixEPPartida(filteredRows) {
        const idx = this._idx;
        const groups = new Map();

        // --- FASE 1: Construir grupos desde RAW data (presupuesto completo) ---
        const rawData = dataManager.getAllRaw();
        const rawRows = window.filterManager ? window.filterManager.getStructurallyFilteredData() : rawData.rows;

        rawRows.forEach(row => {
            const ep = String(row[idx.ep] || '').trim();
            const part = String(row[idx.partida] || '').trim();
            if (!ep || !part) return;

            const key = `${ep}│${part}`;
            if (!groups.has(key)) {
                const denomValue = (typeof DENOMINACIONES !== 'undefined' && DENOMINACIONES[part]) ? DENOMINACIONES[part] : '';
                groups.set(key, {
                    _key: key,
                    EstructuraProgramatica: ep,
                    Partida: part,
                    Denominacion: denomValue,
                    _blockBudgets: {},
                    // Inicializar todos los campos numéricos en 0
                    ...Object.fromEntries(this._numericFields.map(f => [f, 0]))
                });
            }

            const g = groups.get(key);
            this._accumulateRow(g, row);
        });

        // Sumar los máximos de presupuesto por bloque (desde raw data)
        for (const g of groups.values()) {
            for (const blockId in g._blockBudgets) {
                const b = g._blockBudgets[blockId];
                g['Asignado'] += b.asignado;
                g['Monto Actualizado'] += b.montoAct;
                g['Pre Comprometido'] += b.preComp;
            }
        }

        // --- FASE 2: Sobreescribir ejecución desde datos FILTRADOS ---
        const execFields = this._executionFields;
        for (const [, g] of groups) {
            execFields.forEach(f => g[f] = 0);
        }

        filteredRows.forEach(row => {
            const ep = String(row[idx.ep] || '').trim();
            const part = String(row[idx.partida] || '').trim();
            if (!ep || !part) return;

            const key = `${ep}│${part}`;
            const g = groups.get(key);
            if (!g) return;
            g['Comprometido'] += parseFloat(row[idx.comp]) || 0;
            g['Causado'] += parseFloat(row[idx.causado]) || 0;
            g['Pagado'] += parseFloat(row[idx.pagado]) || 0;
            g['Por Pagar'] += parseFloat(row[idx.porPagar]) || 0;
        });

        // Calcular modificación final
        for (const g of groups.values()) {
            g['Modificación'] = g['Aumento'] - g['Disminucion'];
        }

        // Convertir a array, ordenar por EP primero, luego Partida
        return Array.from(groups.values()).map(g => {
            const { _blockBudgets, ...rest } = g;
            return rest;
        }).sort((a, b) => {
            const epCmp = DataAggregator._compareHierarchical(a.EstructuraProgramatica, b.EstructuraProgramatica);
            if (epCmp !== 0) return epCmp;
            return DataAggregator._compareHierarchical(a.Partida, b.Partida);
        });
    }

    // ================================================================
    //  4. RESUMEN POR GENÉRICA (4.01.01.00.00)
    //     Nivel intermedio de la jerarquía de partida
    //     Orden jerárquico ascendente
    // ================================================================
    _aggregateByGenerica(rows) {
        const groups = this._groupBy(rows, 'generica');
        return this._toSortedArray(groups, 'Generica', true);
    }

    // ================================================================
    //  5. RESUMEN POR ESPECÍFICA (4.01.01.01.00)
    //     Nivel de detalle medio-alto
    //     Orden jerárquico ascendente
    // ================================================================
    _aggregateByEspecifica(rows) {
        const groups = this._groupBy(rows, 'especifica');
        return this._toSortedArray(groups, 'Especifica', true);
    }

    // ================================================================
    //  6. RESUMEN POR SUB-ESPECÍFICA (4.01.01.01.01)
    //     Máximo nivel de detalle de la cuenta
    //     Orden jerárquico ascendente
    // ================================================================
    _aggregateBySubEspecifica(rows) {
        const groups = this._groupBy(rows, 'subespec');
        return this._toSortedArray(groups, 'Sub-especifica', true);
    }

    // ================================================================
    //  7. RESUMEN POR ACCIÓN ESPECÍFICA
    //     Mide ejecución por acción/proyecto
    //     Orden jerárquico ascendente
    // ================================================================
    _aggregateByAccion(rows) {
        const groups = this._groupBy(rows, 'accion');
        return this._toSortedArray(groups, 'Accion Especifica', true);
    }

    // ================================================================
    //  9. RESUMEN POR DENOMINACIÓN (nombre de la cuenta)
    //     Útil para ver el detalle del gasto descriptivo
    //     Orden alfabético ascendente
    // ================================================================
    _aggregateByDenominacion(rows) {
        const groups = this._groupBy(rows, 'denom');
        return this._toSortedArray(groups, 'Denominacion', true);
    }

    // ================================================================
    //  TOTALES GLOBALES
    // ================================================================
    /**
     * Calcula los totales globales.
     * Los campos presupuestarios se calculan desde RAW data (completo),
     * los campos de ejecución desde filteredRows (período seleccionado).
     * @param {Array<Array>} rawRows - Todas las filas (para presupuesto)
     * @param {Array<Array>} filteredRows - Filas filtradas (para ejecución)
     * @returns {Object}
     * @private
     */
    _computeGrandTotals(rawRows, filteredRows) {
        const totals = Object.fromEntries(this._numericFields.map(f => [f, 0]));
        const blockBudgets = {};
        const idx = this._idx;

        // --- Presupuesto y Modificaciones Fijas (desde RAW data) ---
        rawRows.forEach(row => {
            totals['Aumento'] += parseFloat(row[idx.aumento]) || 0;
            totals['Disminucion'] += parseFloat(row[idx.disminucion]) || 0;
            
            const cuenta = String(row[idx.cuenta] || '').trim();
            const ep = String(row[idx.ep] || '').trim();
            const accion = String(row[idx.accion] || '').trim();
            const unidad = String(row[idx.unidad] || '').trim();
            const blockId = `${ep}│${accion}│${unidad}│${cuenta}`;

            if (cuenta && ep) {
                if (!blockBudgets[blockId]) {
                    blockBudgets[blockId] = { asignado: 0, montoAct: 0, preComp: 0 };
                }
                const b = blockBudgets[blockId];
                b.asignado = Math.max(b.asignado, parseFloat(row[idx.asignado]) || 0);
                b.montoAct = Math.max(b.montoAct, parseFloat(row[idx.montoAct]) || 0);
                b.preComp = Math.max(b.preComp, parseFloat(row[idx.preComp]) || 0);
            }
        });

        for (const blockId in blockBudgets) {
            const b = blockBudgets[blockId];
            totals['Asignado'] += b.asignado;
            totals['Monto Actualizado'] += b.montoAct;
            totals['Pre Comprometido'] += b.preComp;
        }

        // --- Ejecución (desde FILTERED data) ---
        filteredRows.forEach(row => {
            totals['Comprometido'] += parseFloat(row[idx.comp]) || 0;
            totals['Causado'] += parseFloat(row[idx.causado]) || 0;
            totals['Pagado'] += parseFloat(row[idx.pagado]) || 0;
            totals['Por Pagar'] += parseFloat(row[idx.porPagar]) || 0;
        });

        totals['Modificación'] = totals['Aumento'] - totals['Disminucion'];
        totals['Disponible'] = totals['Monto Actualizado'] - totals['Comprometido'];
        return totals;
    }

    // ================================================================
    //  MÉTODOS PRIVADOS BASE
    // ================================================================

    /**
     * Agrupa filas por una clave jerárquica
     * @param {Array<Array>} rows
     * @param {string} keyName - Nombre de la clave ('partida', 'ep', 'generica', etc.)
     * @returns {Map<string, Object>}
     * @private
     */
    _groupBy(rows, keyName) {
        const idx = this._idx;
        const groups = new Map();

        // Mapa de nombres de clave a índice y nombre para el label
        const keyConfig = {
            partida: { index: idx.partida, label: 'Partida' },
            ep: { index: idx.ep, label: 'Estructura Programatica' },
            unidad: { index: idx.unidad, label: 'Unidad Ejecutora' },
            generica: { index: idx.generica, label: 'Generica' },
            especifica: { index: idx.especifica, label: 'Especifica' },
            subespec: { index: idx.subespec, label: 'Sub-especifica' },
            accion: { index: idx.accion, label: 'Accion Especifica' },
            denom: { index: idx.denom, label: 'Denominacion' }
        };

        const cfg = keyConfig[keyName];
        if (!cfg || cfg.index === undefined || cfg.index === null) return groups;

        rows.forEach(row => {
            if (!row) return;
            let value = String(row[cfg.index] || '').trim();
            if (!value) return;

            // Para sub-específica, si está vacía usar valor de específica
            if (keyName === 'subespec' && !value) return;

            if (!groups.has(value)) {
                const denomValue = (typeof DENOMINACIONES !== 'undefined' && DENOMINACIONES[value]) ? DENOMINACIONES[value] : '';
                groups.set(value, {
                    _key: value,
                    [cfg.label]: value,
                    Denominacion: keyName !== 'denom' ? denomValue : value,
                    _blockBudgets: {},
                    // Inicializar campos numéricos
                    ...Object.fromEntries(this._numericFields.map(f => [f, 0]))
                });
            }

            const g = groups.get(value);
            this._accumulateRow(g, row);
        });

        // Sumar los máximos de presupuesto por bloque
        for (const g of groups.values()) {
            for (const blockId in g._blockBudgets) {
                const b = g._blockBudgets[blockId];
                g['Asignado'] += b.asignado;
                g['Monto Actualizado'] += b.montoAct;
                g['Pre Comprometido'] += b.preComp;
            }
            g['Modificación'] = g['Aumento'] - g['Disminucion'];
        }

        return groups;
    }

    _accumulateRow(group, row) {
        const idx = this._idx;
        const cuenta = String(row[idx.cuenta] || '').trim();
        const ep = String(row[idx.ep] || '').trim();
        const accion = String(row[idx.accion] || '').trim();
        const unidad = String(row[idx.unidad] || '').trim();
        const blockId = `${ep}│${accion}│${unidad}│${cuenta}`;

        // Encontrar el presupuesto máximo para cada bloque
        if (cuenta && ep) {
            if (!group._blockBudgets[blockId]) {
                group._blockBudgets[blockId] = { asignado: 0, montoAct: 0, preComp: 0 };
            }
            const b = group._blockBudgets[blockId];
            b.asignado = Math.max(b.asignado, parseFloat(row[idx.asignado]) || 0);
            b.montoAct = Math.max(b.montoAct, parseFloat(row[idx.montoAct]) || 0);
            b.preComp = Math.max(b.preComp, parseFloat(row[idx.preComp]) || 0);
        }

        // Campos que se suman siempre (movimientos/transacciones)
        group['Aumento'] += parseFloat(row[idx.aumento]) || 0;
        group['Disminucion'] += parseFloat(row[idx.disminucion]) || 0;
        group['Comprometido'] += parseFloat(row[idx.comp]) || 0;
        group['Causado'] += parseFloat(row[idx.causado]) || 0;
        group['Pagado'] += parseFloat(row[idx.pagado]) || 0;
        group['Por Pagar'] += parseFloat(row[idx.porPagar]) || 0;
    }

    /**
     * Convierte el Map de grupos en un array ordenado,
     * calculando campos derivados (Disponible, % Ejecución)
     * @param {Map} groups - Mapa de grupos (key → group object)
     * @param {string} sortField - Campo para ordenar
     * @param {boolean} sortAsc - true = ascendente, false = descendente
     * @returns {Array<Object>}
     * @private
     */
    _toSortedArray(groups, sortField, sortAsc = false) {
        const result = [];
        const numericFields = new Set(this._numericFields);

        for (const [, g] of groups) {
            const { _cuentas, _key, ...data } = g;

            // Calcular Disponible = Monto Actualizado - Comprometido
            data.Disponible = data['Monto Actualizado'] - data['Comprometido'];

            // Calcular % Ejecución Presupuestaria
            data['% Ejecucion'] = data['Monto Actualizado'] > 0
                ? parseFloat(((data['Pagado'] / data['Monto Actualizado']) * 100).toFixed(2))
                : 0;

            // Calcular % Compromiso
            data['% Comprometido'] = data['Monto Actualizado'] > 0
                ? parseFloat(((data['Comprometido'] / data['Monto Actualizado']) * 100).toFixed(2))
                : 0;

            // Saldo por ejecutar (lo que queda por pagar)
            data['Saldo por Ejecutar'] = data['Monto Actualizado'] - data['Pagado'];

            // Saldo del Presupuesto Modificado = Asignado + Aumento - Modificación
            // Representa el saldo presupuestario según la fórmula del usuario
            data['Saldo Modificado'] = data['Asignado'] + data['Aumento'] - data['Modificación'];

            result.push(data);
        }

        // Ordenar: si es campo numérico → sort numérico; si es código/texto → sort jerárquico
        result.sort((a, b) => {
            if (numericFields.has(sortField) || sortField.startsWith('%') || sortField === 'Disponible' || sortField === 'Saldo por Ejecutar' || sortField === 'Saldo Modificado') {
                // Orden numérico
                const va = parseFloat(a[sortField]) || 0;
                const vb = parseFloat(b[sortField]) || 0;
                return sortAsc ? va - vb : vb - va;
            } else {
                // Orden jerárquico/alfabético para códigos presupuestarios y nombres
                const va = String(a[sortField] || '');
                const vb = String(b[sortField] || '');
                const cmp = DataAggregator._compareHierarchical(va, vb);
                return sortAsc ? cmp : -cmp;
            }
        });

        return result;
    }

    /**
     * Filtra un array de resúmenes por texto de búsqueda
     * @param {Array<Object>} data - Array de objetos resumen
     * @param {string} searchTerm - Texto a buscar
     * @returns {Array<Object>}
     */
    static filterSummary(data, searchTerm) {
        if (!searchTerm) return data;
        const term = searchTerm.toLowerCase();
        return data.filter(item =>
            Object.values(item).some(v =>
                String(v).toLowerCase().includes(term)
            )
        );
    }

    /**
     * Exporta un resumen a CSV
     * @param {Array<Object>} data - Array de objetos resumen
     * @param {string} filename - Nombre del archivo
     */
    static exportToCSV(data, filename) {
        if (!data || data.length === 0) return;

        // Determinar headers del objeto (excluir campos internos)
        const headers = Object.keys(data[0]).filter(h => !h.startsWith('_'));

        // Construir CSV
        const csvRows = [];
        csvRows.push(headers.join(','));

        data.forEach(item => {
            const values = headers.map(h => {
                const val = item[h];
                if (typeof val === 'number') {
                    return val.toLocaleString('es-ES', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                    });
                }
                // Escapar comillas en strings
                return `"${String(val).replace(/"/g, '""')}"`;
            });
            csvRows.push(values.join(','));
        });

        const csvString = csvRows.join('\n');
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename || 'resumen_presupuestario.csv';
        link.click();
        URL.revokeObjectURL(link.href);
    }

    /**
     * Obtiene los nombres de las columnas numéricas estándar
     * @returns {string[]}
     */
    static getNumericFields() {
        return [...this.prototype._numericFields];
    }
}

// Instancia global única
const dataAggregator = new DataAggregator();
window.dataAggregator = dataAggregator;
