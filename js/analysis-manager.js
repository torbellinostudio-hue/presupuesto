/* ================================================================
   ANALYSIS-MANAGER.JS — Análisis Específicos Avanzados
   ================================================================
   Módulo rediseñado para proporcionar un Explorador Interactivo:
   - Independiente del filtro global (tiene su propio filtro de mes).
   - Panel 1: Disponibilidad y Traspasos (Por Estructura/Partida).
   - Panel 2: Auditoría de Proveedores (Por Partida Genérica).
   - Panel 3: Visor de Registros Exactos (3 Tiempos).
   ================================================================ */

class AnalysisManager {
  constructor() {
    this._charts = {};
    this._colors = [
      '#5B8FF9', '#5AD8A6', '#F6BD16', '#E8684A', '#B37FEB',
      '#5DC0CF', '#FF9845', '#6DC8EC', '#FF6B81', '#9270CA'
    ];
    this._meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    this._rawRows = [];
    this._headers = [];
    
    // Referencias DOM
    this._mesSelect = document.getElementById('analysis-mes-select');
    this._epSelect = document.getElementById('analysis-ep-select');
    this._accionSelect = document.getElementById('analysis-accion-select');
    this._unidadSelect = document.getElementById('analysis-unidad-select');
    this._partidaMayorSelect = document.getElementById('analysis-partida-mayor-select');
    this._gridContainer = document.getElementById('analysis-grid-container');

    this._bindEvents();
  }

  _bindEvents() {
    if (this._mesSelect) this._mesSelect.addEventListener('change', () => this.refreshPanels());
    if (this._epSelect) this._epSelect.addEventListener('change', () => this._onEPChange());
    if (this._accionSelect) this._accionSelect.addEventListener('change', () => this._onAccionChange());
    if (this._unidadSelect) this._unidadSelect.addEventListener('change', () => this._onUnidadChange());
    if (this._partidaMayorSelect) this._partidaMayorSelect.addEventListener('change', () => this._updatePanelDispo());

    if (this._gridContainer) {
      this._gridContainer.addEventListener('click', (e) => {
        const btn = e.target.closest('.toggle-records-btn');
        if (btn) {
          const card = btn.closest('.analysis-col-card');
          const records = card.querySelector('.analysis-col-records');
          if (records.style.display === 'none') {
            records.style.display = 'flex';
            btn.innerHTML = 'Ocultar Específicas ▲';
            btn.classList.add('active');
          } else {
            records.style.display = 'none';
            btn.innerHTML = 'Ver Específicas ▼';
            btn.classList.remove('active');
          }
        }
      });
    }
  }

  /**
   * Inicializa la clase con los datos puros y llena los selectores.
   * Se llama desde UI Controller cuando se carga un nuevo archivo.
   */
  update(filteredRows) {
    // Tomamos los datos crudos desde DataManager para ser independientes del filtro global
    const rawData = dataManager.getAllRaw();
    this._headers = rawData.headers;
    // Usamos filterManager para descartar filas vacías, pero ignoramos su filtro de fechas.
    this._rawRows = window.filterManager ? window.filterManager.getStructurallyFilteredData() : rawData.rows;

    if (!this._headers || this._rawRows.length === 0) return;

    this._populateDropdowns();
    this.refreshPanels();
  }

  refreshPanels() {
    // Auto-seleccionar primer EP si está vacío
    if (this._epSelect.options.length > 1 && !this._epSelect.value) {
      this._epSelect.selectedIndex = 1;
      this._onEPChange();
    } else {
      this._updatePanelDispo();
    }
  }

  _getDenom(code) {
    if (typeof DENOMINACIONES === 'undefined' || !code) return '';
    let fmt = '';
    const c = String(code);
    if (c.length === 3) {
      fmt = `${c[0]}.${c.substring(1,3)}.00.00.00`;
    } else if (c.length === 5) {
      fmt = `${c[0]}.${c.substring(1,3)}.${c.substring(3,5)}.00.00`;
    } else if (c.length >= 7) {
      const p4 = c.length >= 9 ? c.substring(7,9) : '00';
      fmt = `${c[0]}.${c.substring(1,3)}.${c.substring(3,5)}.${c.substring(5,7)}.${p4}`;
    }
    return DENOMINACIONES[fmt] || '';
  }

  _populateDropdowns() {
    const rows = this._rawRows;
    const h = this._headers;
    const fIdx = h.indexOf('Fecha');
    const epIdx = h.indexOf('Estructura Programatica');
    const pIdx = h.indexOf('Partida');

    // 1. Meses disponibles
    if (fIdx >= 0) {
      const mesesSet = new Set();
      rows.forEach(r => {
        const parts = String(r[fIdx] || '').split('/');
        if (parts.length === 3) {
          const m = parseInt(parts[1]);
          if (m >= 1 && m <= 12) mesesSet.add(m);
        }
      });
      const sortedMeses = [...mesesSet].sort((a,b)=>a-b);
      this._mesSelect.innerHTML = '<option value="">Todos los meses (Acumulado)</option>';
      sortedMeses.forEach(m => {
        this._mesSelect.innerHTML += `<option value="${m}">${this._meses[m-1]}</option>`;
      });
    }

    // 2. Estructura Programática
    if (epIdx >= 0) {
      const epSet = new Set();
      rows.forEach(r => {
        const val = String(r[epIdx] || '').trim();
        if (val) epSet.add(val);
      });
      const sortedEP = [...epSet].sort();
      this._epSelect.innerHTML = '<option value="">Seleccione Estructura...</option>';
      sortedEP.forEach(ep => {
        this._epSelect.innerHTML += `<option value="${ep}">${ep.length > 50 ? ep.slice(0, 48)+'...' : ep}</option>`;
      });
    }

  }

  _onEPChange() {
    const ep = this._epSelect.value;
    this._accionSelect.value = '';
    this._unidadSelect.value = '';

    const h = this._headers;
    const epIdx = h.indexOf('Estructura Programatica');
    const aIdx = h.indexOf('Accion Especifica');
    const uIdx = h.indexOf('Unidad Ejecutora');

    this._accionSelect.innerHTML = '<option value="">Todas las Acciones (Consolidado)</option>';
    this._unidadSelect.innerHTML = '<option value="">Todas las Unidades (Consolidado)</option>';

    if (ep) {
      this._accionSelect.disabled = false;
      this._unidadSelect.disabled = false;
      
      const accSet = new Set();
      const uniSet = new Set();
      this._rawRows.forEach(r => {
        if (String(r[epIdx] || '').trim() === ep) {
          const a = String(r[aIdx] || '').trim();
          if (a) accSet.add(a);
          const u = String(r[uIdx] || '').trim();
          if (u) uniSet.add(u);
        }
      });

      [...accSet].sort().forEach(a => {
        this._accionSelect.innerHTML += `<option value="${a}">${a.length > 50 ? a.slice(0, 48)+'...' : a}</option>`;
      });

      [...uniSet].sort().forEach(u => {
        this._unidadSelect.innerHTML += `<option value="${u}">${u.length > 50 ? u.slice(0, 48)+'...' : u}</option>`;
      });
    } else {
      this._accionSelect.disabled = true;
      this._unidadSelect.disabled = true;
    }

    this._refreshPartidaMayor();
  }

  _onAccionChange() {
    this._unidadSelect.value = '';
    const ep = this._epSelect.value;
    const acc = this._accionSelect.value;

    this._unidadSelect.innerHTML = '<option value="">Todas las Unidades (Consolidado)</option>';
    
    if (ep && acc) {
      const h = this._headers;
      const epIdx = h.indexOf('Estructura Programatica');
      const aIdx = h.indexOf('Accion Especifica');
      const uIdx = h.indexOf('Unidad Ejecutora');
      const uniSet = new Set();
      
      this._rawRows.forEach(r => {
        if (String(r[epIdx] || '').trim() === ep && String(r[aIdx] || '').trim() === acc) {
          const u = String(r[uIdx] || '').trim();
          if (u) uniSet.add(u);
        }
      });
      [...uniSet].sort().forEach(u => {
        this._unidadSelect.innerHTML += `<option value="${u}">${u.length > 50 ? u.slice(0, 48)+'...' : u}</option>`;
      });
    } else if (ep) {
       // if they clear Accion, we should restore all Unidades for that EP
       const h = this._headers;
       const epIdx = h.indexOf('Estructura Programatica');
       const uIdx = h.indexOf('Unidad Ejecutora');
       const uniSet = new Set();
       this._rawRows.forEach(r => {
         if (String(r[epIdx] || '').trim() === ep) {
           const u = String(r[uIdx] || '').trim();
           if (u) uniSet.add(u);
         }
       });
       [...uniSet].sort().forEach(u => {
         this._unidadSelect.innerHTML += `<option value="${u}">${u.length > 50 ? u.slice(0, 48)+'...' : u}</option>`;
       });
    }
    
    this._refreshPartidaMayor();
  }

  _onUnidadChange() {
    this._refreshPartidaMayor();
  }

  _refreshPartidaMayor() {
    const ep = this._epSelect.value;
    const acc = this._accionSelect.value;
    const uni = this._unidadSelect.value;
    
    if (!ep) {
       this._partidaMayorSelect.innerHTML = '<option value="">Seleccione Partida Mayor...</option>';
       this._partidaMayorSelect.disabled = true;
       this._updatePanelDispo();
       return;
    }

    const h = this._headers;
    const epIdx = h.indexOf('Estructura Programatica');
    const aIdx = h.indexOf('Accion Especifica');
    const uIdx = h.indexOf('Unidad Ejecutora');
    const cuentaIdx = h.indexOf('Cuenta'); 
    const genSet = new Set();

    this._rawRows.forEach(r => {
      const matchEp = !ep || String(r[epIdx] || '').trim() === ep;
      const matchAcc = !acc || String(r[aIdx] || '').trim() === acc;
      const matchUni = !uni || String(r[uIdx] || '').trim() === uni;
      
      if (matchEp && matchAcc && matchUni) {
        const p = String(r[cuentaIdx] || '').trim();
        if (p) {
          const mayor = p.replace(/[^0-9]/g, '').substring(0, 3);
          if (mayor.length === 3) genSet.add(mayor);
        }
      }
    });

    const sortedGen = [...genSet].sort();
    const prevVal = this._partidaMayorSelect.value;
    
    this._partidaMayorSelect.innerHTML = '<option value="">Seleccione Partida Mayor...</option>';
    sortedGen.forEach(g => {
      let d = this._getDenom(g);
      if (d.length > 40) d = d.substring(0, 38) + '...';
      const label = d ? `${g} - ${d}` : g;
      this._partidaMayorSelect.innerHTML += `<option value="${g}">${label}</option>`;
    });
    this._partidaMayorSelect.disabled = false;

    if (prevVal && sortedGen.includes(prevVal)) {
      this._partidaMayorSelect.value = prevVal;
    } else if (this._partidaMayorSelect.options.length > 1) {
      this._partidaMayorSelect.selectedIndex = 1;
    }

    this._updatePanelDispo();
  }

  /**
   * Obtiene las filas filtradas por el Mes Local seleccionado en esta sección.
   */
  _getLocalFilteredRows() {
    const mesSel = this._mesSelect.value;
    if (!mesSel) return this._rawRows;
    const mesNum = parseInt(mesSel);
    const fIdx = this._headers.indexOf('Fecha');
    return this._rawRows.filter(r => {
      const parts = String(r[fIdx] || '').split('/');
      return parts.length === 3 && parseInt(parts[1]) === mesNum;
    });
  }

  /* ================================================================
     PANEL 1: DISPONIBILIDAD Y TRASPASOS (Cuadrícula Jerárquica)
     ================================================================ */
  _updatePanelDispo() {
    const ep = this._epSelect.value;
    const acc = this._accionSelect.value;
    const uni = this._unidadSelect.value;
    const partMayor = this._partidaMayorSelect.value;

    if (!ep || !partMayor) {
      this._gridContainer.innerHTML = '<div class="dispo-empty-state" style="grid-column: 1/-1;">Seleccione una estructura (y opcionalmente acción o unidad) y una partida para ver su disponibilidad en cuadrícula.</div>';
      return;
    }

    const h = this._headers;
    const epIdx = h.indexOf('Estructura Programatica');
    const aIdx = h.indexOf('Accion Especifica');
    const uIdx = h.indexOf('Unidad Ejecutora');
    const cuentaIdx = h.indexOf('Cuenta'); 
    const denomIdx = h.indexOf('Denominacion');
    const actIdx = h.indexOf('Asignado'); // Cambiado a Asignado
    const compIdx = h.indexOf('Comprometido');
    const aumIdx = h.indexOf('Aumento');
    const disIdx = h.indexOf('Disminucion');
    const blockIdx = h.indexOf('ID Bloque');

    // Mapear todas las Genéricas -> Específicas
    // Estructura: map[generica] = { asignado, aumento, disminucion, comp, denomRaw, hijas: map[especifica] -> { asignado, aumento, disminucion, comp, denomRaw } }
    const hierarchy = new Map();

    // Helper para formato
    const getClaves = (cuentaRaw) => {
      const c = String(cuentaRaw).replace(/[^0-9]/g, '');
      const mayor = c.substring(0, 3);
      const generica = c.substring(0, 5);
      return { mayor, generica, especifica: c }; // la cuenta completa será la específica
    };

    // 1. Asignado Inicial (por bloque) usando datos RAW completos (MÁXIMO por bloque)
    const maxBudgetByBlock = new Map();

    this._rawRows.forEach(r => {
      const matchEp = !ep || String(r[epIdx] || '').trim() === ep;
      const matchAcc = !acc || String(r[aIdx] || '').trim() === acc;
      const matchUni = !uni || String(r[uIdx] || '').trim() === uni;

      if (matchEp && matchAcc && matchUni) {
        const pRaw = r[cuentaIdx];
        if (!pRaw) return;
        const keys = getClaves(pRaw);
        
        if (keys.mayor === partMayor) {
          const bId = String(r[blockIdx] || '');
          if (bId) {
            const amt = parseFloat(r[actIdx]) || 0; // actIdx ahora apunta a Asignado
            if (!maxBudgetByBlock.has(bId)) {
               maxBudgetByBlock.set(bId, { amt: amt, keys: keys, denom: r[denomIdx] });
            } else {
               const current = maxBudgetByBlock.get(bId);
               if (amt > current.amt) current.amt = amt;
            }
          }
        }
      }
    });

    // Ahora agregamos el Asignado Inicial a la jerarquía
    maxBudgetByBlock.forEach((data) => {
      const keys = data.keys;
      
      if (!hierarchy.has(keys.generica)) {
        hierarchy.set(keys.generica, { asignado: 0, aumento: 0, disminucion: 0, comp: 0, denomRaw: '', hijas: new Map() });
      }
      const genNode = hierarchy.get(keys.generica);
      if (!genNode.hijas.has(keys.especifica)) {
        genNode.hijas.set(keys.especifica, { asignado: 0, aumento: 0, disminucion: 0, comp: 0, denomRaw: '' });
      }
      
      if (denomIdx >= 0) {
        const rDenom = String(data.denom || '').trim();
        if (rDenom && !genNode.hijas.get(keys.especifica).denomRaw) {
          genNode.hijas.get(keys.especifica).denomRaw = rDenom;
        }
        if (keys.especifica === keys.generica && rDenom && !genNode.denomRaw) {
          genNode.denomRaw = rDenom;
        }
      }
      
      genNode.asignado += data.amt;
      genNode.hijas.get(keys.especifica).asignado += data.amt;
    });

    // 2. Ejecución (filtrado por mes local)
    const localRows = this._getLocalFilteredRows();
    localRows.forEach(r => {
      const matchEp = !ep || String(r[epIdx] || '').trim() === ep;
      const matchAcc = !acc || String(r[aIdx] || '').trim() === acc;
      const matchUni = !uni || String(r[uIdx] || '').trim() === uni;

      if (matchEp && matchAcc && matchUni) {
        const pRaw = r[cuentaIdx];
        if (!pRaw) return;
        const keys = getClaves(pRaw);
        
        if (keys.mayor === partMayor) {
          if (!hierarchy.has(keys.generica)) {
            hierarchy.set(keys.generica, { asignado: 0, aumento: 0, disminucion: 0, comp: 0, hijas: new Map() });
          }
          const genNode = hierarchy.get(keys.generica);
          if (!genNode.hijas.has(keys.especifica)) {
            genNode.hijas.set(keys.especifica, { asignado: 0, aumento: 0, disminucion: 0, comp: 0 });
          }
          
          const valAum = parseFloat(r[aumIdx]) || 0;
          const valDis = parseFloat(r[disIdx]) || 0;
          const valComp = parseFloat(r[compIdx]) || 0;
          
          genNode.aumento += valAum;
          genNode.disminucion += valDis;
          genNode.comp += valComp;
          
          genNode.hijas.get(keys.especifica).aumento += valAum;
          genNode.hijas.get(keys.especifica).disminucion += valDis;
          genNode.hijas.get(keys.especifica).comp += valComp;
        }
      }
    });

    // 3. Renderizar Cuadrícula
    let gridHtml = '';
    const sortedGen = Array.from(hierarchy.keys()).sort();

    if (sortedGen.length === 0) {
      this._gridContainer.innerHTML = '<div class="dispo-empty-state" style="grid-column: 1/-1;">No hay datos para esta partida en la estructura seleccionada.</div>';
      return;
    }

    sortedGen.forEach(genKey => {
      const genData = hierarchy.get(genKey);
      
      const gActualizado = genData.asignado + genData.aumento - genData.disminucion;
      const gSaldo = gActualizado - genData.comp;
      const gPctComp = gActualizado > 0 ? (genData.comp / gActualizado) * 100 : (genData.comp > 0 ? 100 : 0);
      const gPctDisp = gActualizado > 0 ? (gSaldo / gActualizado) * 100 : 0;
      const gColorDisp = gSaldo >= 0 && gPctDisp > 50 ? '#5AD8A6' : '#E8684A';
      const gBarColor = gSaldo < 0 ? '#E8684A' : '#888888';
      
      let denomGen = genData.denomRaw || this._getDenom(genKey);
      if (!denomGen) denomGen = 'GENERAL';

      // HTML de la Tarjeta (Columna)
      let cardHtml = `
        <div class="analysis-col-card">
          <div class="analysis-col-header">
            <div class="analysis-col-title">${genKey} - ${denomGen}</div>
            <div class="dispo-labels" style="display: flex; justify-content: space-between; flex-wrap: wrap; gap: 4px;">
              <span>Actualizado: <strong>${this._fmtMoney(gActualizado)}</strong></span>
              <span>Comp: <strong style="color:#F6BD16">${this._fmtMoney(genData.comp)}</strong></span>
              <span>Disp: <strong style="color:${gColorDisp}">${this._fmtMoney(gSaldo)}</strong></span>
            </div>
            <div class="dispo-bar-wrapper" style="margin-top: 6px;">
              <div class="dispo-bar-bg" style="background: rgba(255,255,255,0.1);">
                <div class="dispo-bar-fill" style="width: ${gPctComp > 100 ? 100 : gPctComp}%; background: ${gBarColor};" title="Comprometido: ${this._fmtMoney(genData.comp)}"></div>
              </div>
            </div>
            <button class="toggle-records-btn">Ver Específicas ▼</button>
          </div>
          <div class="analysis-col-records" style="display: none;">
      `;

      // Hijos (Específicas)
      const sortedEsp = Array.from(genData.hijas.keys()).sort();
      sortedEsp.forEach(espKey => {
        const espData = genData.hijas.get(espKey);
        const eActualizado = espData.asignado + espData.aumento - espData.disminucion;
        const eSaldo = eActualizado - espData.comp;
        const ePctComp = eActualizado > 0 ? (espData.comp / eActualizado) * 100 : (espData.comp > 0 ? 100 : 0);
        let denomEsp = espData.denomRaw || this._getDenom(espKey);

        cardHtml += `
            <div class="record-item" style="margin-bottom: 0; padding: 10px;">
              <div style="font-size: 11px; font-weight: bold; color: var(--color-primary-light); margin-bottom: 2px;">${espKey}</div>
              ${denomEsp ? `<div style="font-size: 9px; color: #aaa; margin-bottom: 6px; line-height: 1.1; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${denomEsp}</div>` : '<div style="margin-bottom: 4px;"></div>'}
              <div class="analysis-col-stats small">
                <span title="Monto Actualizado">Actual: ${this._fmtMoney(eActualizado)}</span>
                <span title="Comprometido" style="color:var(--app-warning)">Comp: ${this._fmtMoney(espData.comp)}</span>
                <span title="Disponible" style="color:${eSaldo < 0 ? 'var(--app-danger)' : 'var(--app-success)'}">Disp: ${this._fmtMoney(eSaldo)}</span>
              </div>
              <div class="dispo-bar-wrapper" style="margin-top: 4px;">
                <div class="dispo-bar-bg" style="height: 4px; background: rgba(255,255,255,0.1);">
                  <div class="dispo-bar-fill" style="width: ${ePctComp > 100 ? 100 : ePctComp}%; background: ${eSaldo < 0 ? '#E8684A' : '#888888'};" title="Comprometido: ${this._fmtMoney(espData.comp)}"></div>
                </div>
              </div>
            </div>
        `;
      });

      cardHtml += `
          </div>
        </div>
      `;
      
      gridHtml += cardHtml;
    });

    this._gridContainer.innerHTML = gridHtml;
  }

  /* ================================================================
     PANEL 2: AUDITORÍA DE PROVEEDORES (Con Proveedor)
     ================================================================ */
  _updatePanelProv() {
    const partGen = this._partidaGenSelect.value;
    const chartEl = document.getElementById('chart-analysis-prov');

    if (!partGen) {
      if (this._charts['prov']) this._charts['prov'].clear();
      return;
    }

    const h = this._headers;
    const pIdx = h.indexOf('Partida');
    const provIdx = h.indexOf('Proveedor/Beneficiario');
    const compIdx = h.indexOf('Comprometido');
    const causIdx = h.indexOf('Causado');
    const pagIdx = h.indexOf('Pagado');

    const localRows = this._getLocalFilteredRows();
    const map = new Map(); // Proveedor -> { comp, caus, pag, rows }

    localRows.forEach(r => {
      const p = String(r[pIdx] || '').trim();
      if (p.startsWith(partGen)) {
        let prov = String(r[provIdx] || '').trim();
        if (!prov) prov = 'Sin Proveedor';
        
        if (!map.has(prov)) map.set(prov, { comp: 0, caus: 0, pag: 0, rows: [] });
        const obj = map.get(prov);
        obj.comp += parseFloat(r[compIdx]) || 0;
        obj.caus += parseFloat(r[causIdx]) || 0;
        obj.pag += parseFloat(r[pagIdx]) || 0;
        obj.rows.push(r);
      }
    });

    // Top 10 por Causado (o Comprometido)
    const sorted = Array.from(map.entries())
      .filter(([, v]) => v.comp > 0 || v.caus > 0 || v.pag > 0)
      .sort((a, b) => (b[1].caus > 0 ? b[1].caus : b[1].comp) - (a[1].caus > 0 ? a[1].caus : a[1].comp))
      .slice(0, 10);

    if (!this._charts['prov']) this._charts['prov'] = echarts.init(chartEl);
    const chart = this._charts['prov'];

    if (sorted.length === 0) {
      chart.clear();
      chart.setOption({ title: { text: 'Sin movimientos', left: 'center', top: 'center', textStyle: { color: '#888' } } }, true);
      return;
    }

    const names = sorted.map(([n]) => n.length > 25 ? n.slice(0, 23) + '…' : n).reverse();
    const compData = sorted.map(([, v]) => v.comp).reverse();
    const causData = sorted.map(([, v]) => v.caus).reverse();
    const pagData = sorted.map(([, v]) => v.pag).reverse();

    chart.setOption({
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { data: ['Comprometido', 'Causado', 'Pagado'], textStyle: { color: '#aaa', fontSize: 10 }, top: 0 },
      grid: { top: 30, right: 20, bottom: 20, left: 140 },
      xAxis: { type: 'value', axisLabel: { color: '#888', formatter: v => this._fmtShort(v) }, splitLine: { lineStyle: { color: '#333' } } },
      yAxis: { type: 'category', data: names, axisLabel: { color: '#c0c4d0', fontSize: 9 }, axisLine: { show: false }, axisTick: { show: false } },
      series: [
        { name: 'Comprometido', type: 'bar', data: compData, itemStyle: { color: this._colors[2], borderRadius: [0,2,2,0] }, barMaxWidth: 10, barGap: '0%' },
        { name: 'Causado', type: 'bar', data: causData, itemStyle: { color: this._colors[1], borderRadius: [0,2,2,0] }, barMaxWidth: 10, barGap: '0%' },
        { name: 'Pagado', type: 'bar', data: pagData, itemStyle: { color: this._colors[3], borderRadius: [0,2,2,0] }, barMaxWidth: 10, barGap: '0%' }
      ]
    }, true);

    // Evento click -> Llenar tabla
    chart.off('click');
    chart.on('click', (params) => {
      const idx = sorted.length - 1 - params.dataIndex;
      const provName = sorted[idx][0];
      const provRows = sorted[idx][1].rows;
      this._fillRecordsTable(provRows, `Registros de ${provName}`);
    });
  }

  _clearRecords() {
    const localRows = this._getLocalFilteredRows();
    const limit = Math.min(localRows.length, 30);
    const sampleRows = localRows.slice(0, limit);
    if (sampleRows.length > 0) {
      this._fillRecordsTable(sampleRows, `Últimas Transacciones (Muestra General)`);
    } else {
      this._recordsContainer.innerHTML = '<div class="records-empty-state">No hay transacciones para el filtro actual.</div>';
    }
  }

  _fillRecordsTable(rows, title) {
    if (!rows || rows.length === 0) {
      this._clearRecords();
      return;
    }

    const h = this._headers;
    const fIdx = h.indexOf('Fecha');
    const compbIdx = h.indexOf('Comprobante');
    const detIdx = h.indexOf('Denominacion') > -1 ? h.indexOf('Denominacion') : h.indexOf('Detalle'); // Usa el mejor campo descriptivo
    const provIdx = h.indexOf('Proveedor/Beneficiario');
    const compIdx = h.indexOf('Comprometido');
    const causIdx = h.indexOf('Causado');
    const pagIdx = h.indexOf('Pagado');

    let html = `<div style="font-size:12px; margin-bottom:10px; color:var(--color-primary); font-weight:bold;">${title} (${rows.length} registros)</div>`;
    
    rows.forEach(r => {
      const fecha = String(r[fIdx] || '-');
      const compb = String(r[compbIdx] || 'S/N');
      const desc = String(r[detIdx] || '-');
      const prov = String(r[provIdx] || '-');
      const valComp = parseFloat(r[compIdx]) || 0;
      const valCaus = parseFloat(r[causIdx]) || 0;
      const valPag = parseFloat(r[pagIdx]) || 0;

      // Solo mostrar registros que tienen movimiento en los 3 tiempos
      if (valComp === 0 && valCaus === 0 && valPag === 0) return;

      html += `
        <div class="record-item">
          <div class="record-header">
            <span>📅 ${fecha} | 📄 Comp: ${compb}</span>
            <span>${prov.slice(0, 25)}</span>
          </div>
          <div class="record-desc" title="${desc}">${desc}</div>
          <div class="record-amounts">
            <div class="amt-col"><span class="amt-label">Comprometido</span><span class="amt-val amt-comp">${this._fmtMoney(valComp)}</span></div>
            <div class="amt-col"><span class="amt-label">Causado</span><span class="amt-val amt-caus">${this._fmtMoney(valCaus)}</span></div>
            <div class="amt-col"><span class="amt-label">Pagado</span><span class="amt-val amt-pag">${this._fmtMoney(valPag)}</span></div>
          </div>
        </div>
      `;
    });

    this._recordsContainer.innerHTML = html;
  }

  /* ================================================================
     UTILIDADES
     ================================================================ */
  _fmtMoney(v) {
    if (!v && v !== 0) return '0,00';
    return Number(v).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  _fmtShort(v) {
    if (v === 0) return '0';
    const abs = Math.abs(v);
    if (abs >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'M';
    if (abs >= 1_000) return (v / 1_000).toFixed(0) + 'K';
    return Number(v).toLocaleString('es-VE', { maximumFractionDigits: 0 });
  }

  resize() {
    Object.values(this._charts).forEach(c => c.resize());
  }
}

const analysisManager = new AnalysisManager();
window.analysisManager = analysisManager;
