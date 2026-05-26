/* ================================================================
   FILTER-MANAGER.JS — Gestión centralizada de filtros globales
   ================================================================
   Patrón Observer: cuando un filtro cambia, notifica a todos
   los suscriptores (KPIs, Dashboard, Tabla, Análisis).
   ================================================================ */

class FilterManager {
  constructor() {
    /** @type {Function[]} Callbacks suscritos */
    this._listeners = [];

    /** Estado actual de filtros */
    this._state = {
      fechaInicio: '',
      fechaFin: '',
      estructura: '',
      unidad: '',
      partida: '',
      partidaEspecifica: '',
      mes: '',           // '' = todos, '1'..'12' para mes específico
      modalidad: 'acumulado'  // 'acumulado' | 'mensual'
    };

    /** Nombres de los meses en español */
    this._meses = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];

    /** Flag para evitar notificaciones durante actualización batch */
    this._isUpdating = false;

    // Referencias DOM
    this._fechaInicio = document.getElementById('filtro-fecha-inicio');
    this._fechaFin = document.getElementById('filtro-fecha-fin');
    this._estructura = document.getElementById('filtro-estructura');
    this._unidad = document.getElementById('filtro-unidad');
    this._partida = document.getElementById('filtro-partida');
    this._partidaEspecifica = document.getElementById('filtro-partida-especifica');
    this._resetBtn = document.getElementById('btn-reset-filters');
    this._activeFilters = document.getElementById('active-filters');

    // Nuevos: mes y modalidad
    this._mesSelect = document.getElementById('filtro-mes');
    this._modalidadBtns = document.querySelectorAll('#toggle-mes-modalidad .toggle-btn');

    this._bindEvents();
  }

  /**
   * Suscribe un callback que se ejecuta cuando cambian los filtros
   * @param {Function} fn - Recibe (filteredData, filterState)
   */
  subscribe(fn) {
    this._listeners.push(fn);
  }

  /**
   * Notifica a todos los suscriptores
   * @private
   */
  _notify() {
    const filtered = this.getFilteredData();
    this._listeners.forEach(fn => {
      try { fn(filtered, { ...this._state }); }
      catch (e) { console.error('FilterManager listener error:', e); }
    });
    this._renderActiveFilters();
  }

  /**
   * Vincula eventos de los controles de filtro
   * @private
   */
  _bindEvents() {
    // Debounce para inputs de texto
    let provTimer = null;

    this._fechaInicio.addEventListener('change', () => {
      this._state.fechaInicio = this._fechaInicio.value;
      this._notify();
    });

    this._fechaFin.addEventListener('change', () => {
      this._state.fechaFin = this._fechaFin.value;
      this._notify();
    });

    this._estructura.addEventListener('change', () => {
      this._state.estructura = this._estructura.value;
      this._notify();
    });

    this._unidad.addEventListener('change', () => {
      this._state.unidad = this._unidad.value;
      this._notify();
    });

    this._partida.addEventListener('change', () => {
      this._state.partida = this._partida.value;
      this._state.partidaEspecifica = '';
      this._populatePartidaEspecifica();
      this._notify();
    });

    this._partidaEspecifica.addEventListener('change', () => {
      this._state.partidaEspecifica = this._partidaEspecifica.value;
      this._notify();
    });

    // ---- FILTRO DE MES ---- //
    this._mesSelect.addEventListener('change', () => {
      this._state.mes = this._mesSelect.value;
      this._syncDateRangeFromMonth();
      this._notify();
    });

    // ---- MODALIDAD (Acumulado / Mensual) ---- //
    this._modalidadBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        this._modalidadBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this._state.modalidad = btn.dataset.value;
        this._syncDateRangeFromMonth();
        this._notify();
      });
    });

    this._resetBtn.addEventListener('click', () => this.resetAll());
  }

  /**
   * Pobla los selectores de filtro con valores únicos de los datos
   */
  /**
   * Sincroniza los filtros de fecha (Desde/Hasta) según el mes seleccionado
   * @private
   */
  _syncDateRangeFromMonth() {
    if (!this._state.mes) return;

    const raw = dataManager.getAllRaw();
    const headers = raw.headers;
    const rows = raw.rows;
    const fechaIdx = headers.indexOf('Fecha');
    if (fechaIdx < 0) return;

    const mesNum = parseInt(this._state.mes);

    // Obtener todos los años disponibles para este mes
    const years = new Set();
    rows.forEach(row => {
      const fecha = String(row[fechaIdx] || '');
      const parts = fecha.split('/');
      if (parts.length === 3 && parseInt(parts[1]) === mesNum) {
        years.add(parts[2]);
      }
    });

    if (years.size === 0) return;
    const year = Math.max(...years); // Usar el año más reciente

    if (this._state.modalidad === 'acumulado') {
      // Desde inicio del año hasta fin del mes seleccionado
      this._state.fechaInicio = `${year}-01-01`;
      this._state.fechaFin = `${year}-${String(mesNum).padStart(2, '0')}-31`;
    } else {
      // Solo el mes seleccionado
      this._state.fechaInicio = `${year}-${String(mesNum).padStart(2, '0')}-01`;
      this._state.fechaFin = `${year}-${String(mesNum).padStart(2, '0')}-31`;
    }

    this._fechaInicio.value = this._state.fechaInicio;
    this._fechaFin.value = this._state.fechaFin;
  }

  /**
   * Pobla los selectores de filtro con valores únicos de los datos
   */
  populateFromData() {
    const raw = dataManager.getAllRaw();
    const headers = raw.headers;
    const rows = raw.rows;

    // ---- Poblar selector de meses ---- //
    const fechaIdx2 = headers.indexOf('Fecha');
    if (fechaIdx2 >= 0) {
      const mesesDisponibles = new Set();
      rows.forEach(row => {
        const fecha = String(row[fechaIdx2] || '');
        const parts = fecha.split('/');
        if (parts.length === 3) {
          const mes = parseInt(parts[1]);
          if (mes >= 1 && mes <= 12) mesesDisponibles.add(mes);
        }
      });

      // Limpiar opciones existentes
      this._mesSelect.innerHTML = '<option value="">Todos los meses</option>';

      // Agregar meses disponibles (ordenados)
      const sortedMeses = [...mesesDisponibles].sort((a, b) => a - b);
      sortedMeses.forEach(m => {
        const opt = document.createElement('option');
        opt.value = String(m);
        opt.textContent = this._meses[m - 1];
        this._mesSelect.appendChild(opt);
      });
    }

    // Estructura Programática
    const epIdx = headers.indexOf('Estructura Programatica');
    if (epIdx >= 0) {
      const unique = [...new Set(rows.map(r => String(r[epIdx] || '').trim()).filter(v => v))].sort();
      this._estructura.innerHTML = '<option value="">Todas</option>';
      unique.forEach(v => {
        const opt = document.createElement('option');
        opt.value = v;
        opt.textContent = v;
        this._estructura.appendChild(opt);
      });
    }

    // Unidad Ejecutora
    const uIdx = headers.indexOf('Unidad Ejecutora');
    if (uIdx >= 0) {
      const uniqueU = [...new Set(rows.map(r => String(r[uIdx] || '').trim()).filter(v => v))].sort();
      this._unidad.innerHTML = '<option value="">Todas</option>';
      uniqueU.forEach(v => {
        const opt = document.createElement('option');
        opt.value = v;
        opt.textContent = v;
        this._unidad.appendChild(opt);
      });
    }

    // Partida Genérica (primeros 2 segmentos, ej: "4.01")
    const pIdx = headers.indexOf('Partida');
    if (pIdx >= 0) {
      // Extraer códigos genéricos únicos (primeros dos segmentos)
      const genericSet = new Set();
      const allPartidas = [...new Set(rows.map(r => String(r[pIdx] || '').trim()).filter(v => v))].sort();
      allPartidas.forEach(v => {
        const segments = v.split('.');
        const generic = segments.slice(0, 2).join('.');
        if (generic) genericSet.add(generic);
      });
      const genericSorted = [...genericSet].sort();
      this._partida.innerHTML = '<option value="">Todas</option>';
      genericSorted.forEach(v => {
        const denom = (typeof DENOMINACIONES !== 'undefined' && DENOMINACIONES[v]) ? DENOMINACIONES[v] : '';
        const opt = document.createElement('option');
        opt.value = v;
        opt.textContent = denom ? `${v} — ${denom}` : v;
        this._partida.appendChild(opt);
      });

      // Inicializar dropdown de específica (deshabilitado)
      this._populatePartidaEspecifica();
    }

    // Fechas: establecer rango por defecto
    const fechaIdx = headers.indexOf('Fecha');
    if (fechaIdx >= 0) {
      const fechas = rows
        .map(r => this._parseDate(String(r[fechaIdx] || '')))
        .filter(d => d && !isNaN(d.getTime()))
        .sort((a, b) => a - b);
      if (fechas.length > 0) {
        this._fechaInicio.value = this._toInputDate(fechas[0]);
        this._fechaFin.value = this._toInputDate(fechas[fechas.length - 1]);
        this._state.fechaInicio = this._fechaInicio.value;
        this._state.fechaFin = this._fechaFin.value;
      }
    }
  }

  /**
   * Obtiene los datos filtrados según el estado actual
   * @returns {Array<Array>} Filas filtradas
   */
  getFilteredData() {
    const raw = dataManager.getAllRaw();
    const headers = raw.headers;
    const rows = raw.rows;

    const epIdx = headers.indexOf('Estructura Programatica');
    const uIdx = headers.indexOf('Unidad Ejecutora');
    const pIdx = headers.indexOf('Partida');
    const fechaIdx = headers.indexOf('Fecha');

    const fechaIni = this._parseInputDate(this._state.fechaInicio);
    const fechaFin = this._parseInputDate(this._state.fechaFin);
    if (fechaFin) fechaFin.setHours(23, 59, 59, 999);

    return rows.filter(row => {
      // Filtro fecha
      if (fechaIdx >= 0 && (fechaIni || fechaFin)) {
        const d = this._parseDate(String(row[fechaIdx] || ''));
        if (d) {
          if (fechaIni && d < fechaIni) return false;
          if (fechaFin && d > fechaFin) return false;
        }
      }

      // Filtro estructura
      if (this._state.estructura && epIdx >= 0) {
        if (String(row[epIdx] || '').trim() !== this._state.estructura) return false;
      }

      // Filtro unidad
      if (this._state.unidad && uIdx >= 0) {
        if (String(row[uIdx] || '').trim() !== this._state.unidad) return false;
      }

      // Filtro partida genérica
      if (this._state.partida && pIdx >= 0) {
        if (!String(row[pIdx] || '').startsWith(this._state.partida)) return false;
      }

      // Filtro partida específica
      const especIdx = headers.indexOf('Especifica');
      if (this._state.partidaEspecifica && especIdx >= 0) {
        if (String(row[especIdx] || '').trim() !== this._state.partidaEspecifica) return false;
      }

      return true;
    });
  }

  /**
   * Obtiene los datos originales filtrados SÓLO por estructura y partida,
   * ignorando los filtros de fechas. Útil para calcular el presupuesto base.
   */
  getStructurallyFilteredData() {
    const raw = dataManager.getAllRaw();
    const headers = raw.headers;
    const rows = raw.rows;

    const epIdx = headers.indexOf('Estructura Programatica');
    const uIdx = headers.indexOf('Unidad Ejecutora');
    const pIdx = headers.indexOf('Partida');
    const especIdx = headers.indexOf('Especifica');

    return rows.filter(row => {
      // Filtro estructura
      if (this._state.estructura && epIdx >= 0) {
        if (String(row[epIdx] || '').trim() !== this._state.estructura) return false;
      }
      // Filtro unidad
      if (this._state.unidad && uIdx >= 0) {
        if (String(row[uIdx] || '').trim() !== this._state.unidad) return false;
      }
      // Filtro partida genérica
      if (this._state.partida && pIdx >= 0) {
        if (!String(row[pIdx] || '').startsWith(this._state.partida)) return false;
      }
      // Filtro partida específica
      if (this._state.partidaEspecifica && especIdx >= 0) {
        if (String(row[especIdx] || '').trim() !== this._state.partidaEspecifica) return false;
      }
      return true;
    });
  }

  /**
   * Obtiene los headers actuales (pasthrough a dataManager)
   * @returns {string[]}
   */
  getHeaders() {
    return dataManager.getAllRaw().headers;
  }

  /**
   * Obtiene una copia del estado actual de filtros
   * @returns {Object}
   */
  getState() {
    return { ...this._state };
  }

  /**
   * Pobla el dropdown de Partida Específica según la genérica seleccionada
   * @private
   */
  _populatePartidaEspecifica() {
    const raw = dataManager.getAllRaw();
    const headers = raw.headers;
    const rows = raw.rows;
    const pIdx = headers.indexOf('Especifica');
    if (pIdx < 0) return;

    const generic = this._state.partida;
    this._partidaEspecifica.innerHTML = '<option value="">Todas</option>';

    if (!generic) {
      this._partidaEspecifica.disabled = true;
      return;
    }

    // Filtrar partidas específicas que comienzan con el código genérico
    const specificas = [...new Set(rows
      .map(r => String(r[pIdx] || '').trim())
      .filter(v => v && v.startsWith(generic) && !v.endsWith('00.00.00')) // Excluir las puramente genéricas
    )].sort();

    if (specificas.length === 0) {
      this._partidaEspecifica.disabled = true;
      return;
    }

    this._partidaEspecifica.disabled = false;
    specificas.forEach(v => {
      const denom = (typeof DENOMINACIONES !== 'undefined' && DENOMINACIONES[v]) ? DENOMINACIONES[v] : '';
      const opt = document.createElement('option');
      opt.value = v;
      opt.textContent = denom ? `${v} — ${denom}` : v;
      this._partidaEspecifica.appendChild(opt);
    });
  }

  /**
   * Resetea todos los filtros
   */
  resetAll() {
    // Restore original date range
    const raw = dataManager.getAllRaw();
    const headers = raw.headers;
    const rows = raw.rows;
    const fechaIdx = headers.indexOf('Fecha');

    this._state = {
      fechaInicio: '',
      fechaFin: '',
      estructura: '',
      unidad: '',
      partida: '',
      partidaEspecifica: '',
      mes: '',
      modalidad: 'acumulado'
    };

    if (fechaIdx >= 0) {
      const fechas = rows
        .map(r => this._parseDate(String(r[fechaIdx] || '')))
        .filter(d => d && !isNaN(d.getTime()))
        .sort((a, b) => a - b);
      if (fechas.length > 0) {
        this._state.fechaInicio = this._toInputDate(fechas[0]);
        this._state.fechaFin = this._toInputDate(fechas[fechas.length - 1]);
      }
    }

    this._fechaInicio.value = this._state.fechaInicio;
    this._fechaFin.value = this._state.fechaFin;
    this._estructura.value = '';
    if(this._unidad) this._unidad.value = '';
    this._partida.value = '';
    this._partidaEspecifica.value = '';
    this._partidaEspecifica.disabled = true;

    // Reset mes y modalidad
    this._mesSelect.value = '';
    this._modalidadBtns.forEach(b => b.classList.remove('active'));
    const defaultModalidad = document.querySelector('#toggle-mes-modalidad .toggle-btn[data-value="acumulado"]');
    if (defaultModalidad) defaultModalidad.classList.add('active');

    this._notify();
  }

  /**
   * Renderiza los chips de filtros activos
   * @private
   */
  _renderActiveFilters() {
    this._activeFilters.innerHTML = '';
    const items = [];

    if (this._state.mes) {
      const mesLabel = this._meses[parseInt(this._state.mes) - 1] || this._state.mes;
      const modalidadLabel = this._state.modalidad === 'acumulado' ? 'Acumulado' : 'Mensual';
      items.push({ key: 'mes', label: `${mesLabel} (${modalidadLabel})` });
    }
    if (this._state.estructura) items.push({ key: 'estructura', label: `EP: ${this._state.estructura}` });
    if (this._state.unidad) items.push({ key: 'unidad', label: `Unidad: ${this._state.unidad}` });
    if (this._state.partida) items.push({ key: 'partida', label: `Partida Genérica: ${this._state.partida}` });
    if (this._state.partidaEspecifica) items.push({ key: 'partidaEspecifica', label: `Partida: ${this._state.partidaEspecifica}` });

    items.forEach(item => {
      const chip = document.createElement('span');
      chip.className = 'filter-chip';
      chip.innerHTML = `${item.label} <span class="chip-remove" data-key="${item.key}">✕</span>`;
      chip.querySelector('.chip-remove').addEventListener('click', (e) => {
        e.stopPropagation();
        this._clearFilter(item.key);
      });
      this._activeFilters.appendChild(chip);
    });
  }

  /**
   * Limpia un filtro individual
   * @param {string} key
   * @private
   */
  _clearFilter(key) {
    this._state[key] = '';
    switch (key) {
      case 'estructura': this._estructura.value = ''; break;
      case 'unidad': this._unidad.value = ''; break;
      case 'partida':
        this._partida.value = '';
        this._state.partidaEspecifica = '';
        this._populatePartidaEspecifica();
        break;
      case 'partidaEspecifica':
        this._partidaEspecifica.value = '';
        this._partidaEspecifica.disabled = true;
        break;
      case 'mes':
        this._mesSelect.value = '';
        this._modalidadBtns.forEach(b => b.classList.remove('active'));
        const defMod = document.querySelector('#toggle-mes-modalidad .toggle-btn[data-value="acumulado"]');
        if (defMod) defMod.classList.add('active');
        this._state.modalidad = 'acumulado';
        break;
    }
    this._notify();
  }

  /**
   * Parsea fecha de input YYYY-MM-DD en hora local
   * @private
   */
  _parseInputDate(str) {
    if (!str) return null;
    const parts = str.split('-');
    if (parts.length !== 3) return null;
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    return isNaN(d.getTime()) ? null : d;
  }

  /**
   * Parsea fecha en formato DD/MM/YYYY
   * @param {string} str
   * @returns {Date|null}
   * @private
   */
  _parseDate(str) {
    if (!str || !str.includes('/')) return null;
    const parts = str.split('/');
    if (parts.length !== 3) return null;
    const d = new Date(parts[2], parts[1] - 1, parts[0]);
    return isNaN(d.getTime()) ? null : d;
  }

  /**
   * Convierte Date a formato YYYY-MM-DD para input[type=date]
   * @param {Date} d
   * @returns {string}
   * @private
   */
  _toInputDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

}

const filterManager = new FilterManager();
window.filterManager = filterManager;
