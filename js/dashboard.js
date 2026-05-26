/* ================================================================
   DASHBOARD.JS — Módulo de gráficos ECharts (5 gráficos)
   ================================================================
   REDISEÑO: Cada gráfico ahora cuenta una historia presupuestaria
   clara con datos correctamente agregados y visualización legible.
   ================================================================ */

class Dashboard {
  constructor() {
    this._charts = {};
    this._colors = [
      '#5B8FF9', '#5AD8A6', '#F6BD16', '#E8684A', '#B37FEB',
      '#5DC0CF', '#FF9845', '#6DC8EC', '#FF6B81', '#9270CA',
      '#269A99', '#FF9EC6', '#43A047', '#D4E157', '#78909C'
    ];
    this._initialized = false;
  }

  init() {
    if (this._initialized) return;
    const ids = [
      'chart-estructura', 'chart-partidas', 'chart-treemap',
      'chart-evolucion', 'chart-disponibilidad',
      'chart-sunburst', 'chart-acciones', 'chart-comparativo-estructura', 'chart-comparativo-partida'
    ];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        this._charts[id] = echarts.init(el, null, { renderer: 'canvas' });
      }
    });
    window.addEventListener('resize', () => {
      Object.values(this._charts).forEach(c => c.resize());
    });
    this._initialized = true;
  }

  /**
   * Actualiza todos los gráficos
   */
  updateAll(filteredRows, filterState) {
    if (!this._initialized) this.init();
    const headers = filterManager.getHeaders();
    const metric = (filterState && filterState.tipoMovimiento) || 'Pagado';

    this._updateEstructura(filteredRows, headers, metric);
    this._updatePartidas(filteredRows, headers, metric, filterState);
    this._updateTreemap(filteredRows, headers, metric);
    this._updateEvolucion(filteredRows, headers, metric);
    this._updateDisponibilidad(filteredRows, headers, metric);

    this._updateSunburst(filteredRows, headers, metric);
    this._updateAcciones(filteredRows, headers, metric);
    this._updateComparativoEstructura(filteredRows, headers);
    this._updateComparativoPartida(filteredRows, headers);

    // Lógica condicional de visualización para "Distribución por Estructura"
    const cardEstructura = document.getElementById('card-chart-estructura');
    const cardPartidas = document.getElementById('card-chart-partidas');
    if (cardEstructura && cardPartidas) {
      if (filterState && filterState.estructura) {
        // Si hay estructura seleccionada, ocultar
        cardEstructura.style.display = 'none';
        // Hacer que partidas ocupe todo el ancho para no dejar huecos
        cardPartidas.classList.add('chart-card-full');
        if (this._charts['chart-partidas']) this._charts['chart-partidas'].resize();
      } else {
        // Si es "Todas", mostrar
        cardEstructura.style.display = 'block';
        cardPartidas.classList.remove('chart-card-full');
        if (this._charts['chart-estructura']) this._charts['chart-estructura'].resize();
        if (this._charts['chart-partidas']) this._charts['chart-partidas'].resize();
      }
    }
  }

  /* ================================================================
     GRÁFICO NUEVO: DISTRIBUCIÓN POR ESTRUCTURA
     Muestra la composición del gasto por Estructura Programática.
     ================================================================ */
  _updateEstructura(rows, headers, metric) {
    const chart = this._charts['chart-estructura'];
    if (!chart) return;

    const epIdx = headers.indexOf('Estructura Programatica');
    const metricIdx = headers.indexOf(metric);
    if (epIdx < 0 || metricIdx < 0) return;

    const map = {};
    rows.forEach(row => {
      const ep = String(row[epIdx] || '').trim();
      if (!ep) return;
      const val = parseFloat(row[metricIdx]) || 0;
      if (val <= 0) return;
      map[ep] = (map[ep] || 0) + val;
    });

    const entries = Object.entries(map).sort((a, b) => b[1] - a[1]);
    if (entries.length === 0) {
      chart.setOption({ title: { text: 'Sin datos', left: 'center', top: 'center', textStyle: { color: '#888' } }, series: [] }, true);
      return;
    }

    const total = entries.reduce((s, [, v]) => s + v, 0);
    const data = entries.map(([name, value]) => {
      const shortName = name.split(' ')[0] || name; // ej. "AC1"
      const pct = ((value / total) * 100).toFixed(1);
      return { name: shortName, fullName: name, value, pct };
    });

    chart.setOption({
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(20,24,36,0.95)',
        borderColor: 'rgba(255,255,255,0.1)',
        textStyle: { color: '#e0e0e0', fontSize: 12 },
        confine: true,
        formatter: p => `<strong>${p.data.fullName}</strong><br/>${metric}: <strong>${this._fmtMoney(p.value)}</strong><br/>Proporción: ${p.data.pct}%`
      },
      legend: {
        type: 'scroll',
        orient: 'vertical',
        right: 0,
        top: 'middle',
        textStyle: { color: '#a0a0a0' }
      },
      series: [{
        type: 'pie',
        radius: ['45%', '75%'],
        center: ['35%', '50%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 8,
          borderColor: '#141824',
          borderWidth: 2
        },
        label: { show: false },
        data: data
      }],
      color: this._colors
    }, true);
  }

  /* ================================================================
     GRÁFICO NUEVO: MAPA DE DISTRIBUCIÓN PRESUPUESTARIA (TREEMAP)
     Jerarquía: Estructura -> Partida Genérica
     ================================================================ */
  _updateTreemap(rows, headers, metric) {
    const chart = this._charts['chart-treemap'];
    if (!chart) return;

    const epIdx = headers.indexOf('Estructura Programatica');
    const pIdx = headers.indexOf('Partida');
    const metricIdx = headers.indexOf(metric);
    if (epIdx < 0 || pIdx < 0 || metricIdx < 0) return;

    const hierarchy = {};

    rows.forEach(row => {
      const ep = String(row[epIdx] || '').trim();
      const partida = String(row[pIdx] || '').trim();
      if (!ep || !partida) return;

      const val = parseFloat(row[metricIdx]) || 0;
      if (val <= 0) return;

      const epShort = ep.split(' ')[0] || ep;
      const generic = partida.split('.').slice(0, 2).join('.');
      
      if (!hierarchy[epShort]) hierarchy[epShort] = { name: epShort, fullName: ep, value: 0, children: {} };
      hierarchy[epShort].value += val;

      if (!hierarchy[epShort].children[generic]) {
         const fullCode = generic + '.00.00.00';
         const denom = (typeof DENOMINACIONES !== 'undefined' && DENOMINACIONES[fullCode]) ? DENOMINACIONES[fullCode] : generic;
         hierarchy[epShort].children[generic] = { name: generic, fullName: denom, value: 0 };
      }
      hierarchy[epShort].children[generic].value += val;
    });

    const data = Object.values(hierarchy).map(epNode => {
      return {
        name: epNode.name,
        value: epNode.value,
        children: Object.values(epNode.children).map(pNode => ({
          name: pNode.name + ' ' + (pNode.fullName.length > 20 ? pNode.fullName.slice(0, 18) + '...' : pNode.fullName),
          value: pNode.value
        }))
      };
    });

    if (data.length === 0) {
      chart.setOption({ title: { text: 'Sin datos', left: 'center', top: 'center', textStyle: { color: '#888' } }, series: [] }, true);
      return;
    }

    chart.setOption({
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(20,24,36,0.95)',
        borderColor: 'rgba(255,255,255,0.1)',
        textStyle: { color: '#e0e0e0', fontSize: 12 },
        confine: true,
        formatter: p => `<strong>${p.name}</strong><br/>${metric}: <strong>${this._fmtMoney(p.value)}</strong>`
      },
      series: [{
        type: 'treemap',
        data: data,
        roam: false,
        nodeClick: false,
        breadcrumb: { show: false },
        itemStyle: {
          borderColor: '#141824',
          borderWidth: 2,
          gapWidth: 2
        },
        levels: [
          { itemStyle: { borderWidth: 2, borderColor: '#141824' } },
          { colorSaturation: [0.3, 0.6], itemStyle: { borderWidth: 1, borderColor: '#141824' } }
        ]
      }],
      color: this._colors
    }, true);
  }

  /* ================================================================
     GRÁFICO NUEVO: DISPONIBILIDAD VS EJECUCIÓN (BARRAS APILADAS 100%)
     Compara Ejecutado vs Disponible por Partida
     ================================================================ */
  _updateDisponibilidad(rows, headers, metric) {
    const chart = this._charts['chart-disponibilidad'];
    if (!chart) return;

    const pIdx = headers.indexOf('Partida');
    const asignadoIdx = headers.indexOf('Monto Actualizado'); // Usamos el presupuesto modificado
    const metricIdx = headers.indexOf(metric);
    const blockIdIdx = headers.indexOf('ID Bloque');
    
    if (pIdx < 0 || asignadoIdx < 0 || metricIdx < 0 || blockIdIdx < 0) return;

    const map = {};
    const processedBlocks = new Set();

    rows.forEach(row => {
      const partida = String(row[pIdx] || '').trim();
      const blockId = String(row[blockIdIdx] || '').trim();
      if (!partida) return;

      const generic = partida.split('.').slice(0, 2).join('.');
      if (!map[generic]) map[generic] = { ejecutado: 0, presupuesto: 0 };

      // Sumar ejecución (siempre)
      map[generic].ejecutado += parseFloat(row[metricIdx]) || 0;

      // Sumar presupuesto SOLO una vez por bloque único
      if (blockId && !processedBlocks.has(blockId)) {
        processedBlocks.add(blockId);
        map[generic].presupuesto += parseFloat(row[asignadoIdx]) || 0;
      }
    });

    const sortedEntries = Object.entries(map).filter(([, v]) => v.presupuesto > 0).sort((a, b) => a[0].localeCompare(b[0]));

    if (sortedEntries.length === 0) {
      chart.setOption({ title: { text: 'Sin datos', left: 'center', top: 'center', textStyle: { color: '#888' } }, series: [] }, true);
      return;
    }

    const entries = sortedEntries.map(([k, v]) => {
      const fullCode = k + '.00.00.00';
      const denom = (typeof DENOMINACIONES !== 'undefined' && DENOMINACIONES[fullCode]) ? DENOMINACIONES[fullCode] : '';
      const label = denom ? `${k} ${denom.length > 25 ? denom.slice(0, 22) + '…' : denom}` : k;
      return { k, label, v };
    });

    const categories = entries.map(e => e.label);
    const ejecutadoData = entries.map(e => {
      const pct = (e.v.ejecutado / e.v.presupuesto) * 100;
      return pct > 100 ? 100 : pct; // Cap at 100% for the stack
    });
    const disponibleData = entries.map(e => {
      const pct = ((e.v.presupuesto - e.v.ejecutado) / e.v.presupuesto) * 100;
      return pct < 0 ? 0 : pct;
    });

    chart.setOption({
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: 'rgba(20,24,36,0.95)',
        borderColor: 'rgba(255,255,255,0.1)',
        textStyle: { color: '#e0e0e0', fontSize: 12 },
        confine: true,
        formatter: params => {
          const idx = params[0].dataIndex;
          const e = entries[idx];
          const v = e.v;
          const disp = v.presupuesto - v.ejecutado;
          return `<strong>${e.label}</strong><br/>
                  Presupuesto: <strong>${this._fmtMoney(v.presupuesto)}</strong><br/>
                  Ejecutado: <strong>${this._fmtMoney(v.ejecutado)}</strong> (${params[0].value.toFixed(1)}%)<br/>
                  Disponible: <strong>${this._fmtMoney(disp)}</strong> (${params[1].value.toFixed(1)}%)`;
        }
      },
      legend: { data: ['Ejecutado', 'Disponible'], textStyle: { color: '#a0a0a0' }, bottom: 0 },
      grid: { left: '3%', right: '4%', bottom: '15%', top: '10%', containLabel: true },
      xAxis: { type: 'value', max: 100, axisLabel: { formatter: '{value}%', color: '#a0a0a0' }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } } },
      yAxis: { type: 'category', data: categories, axisLabel: { color: '#a0a0a0' }, inverse: true },
      series: [
        {
          name: 'Ejecutado',
          type: 'bar',
          stack: 'total',
          itemStyle: { color: '#5B8FF9', borderRadius: [0, 0, 0, 0] },
          data: ejecutadoData
        },
        {
          name: 'Disponible',
          type: 'bar',
          stack: 'total',
          itemStyle: { color: '#43A047', borderRadius: [0, 4, 4, 0] },
          data: disponibleData
        }
      ]
    }, true);
  }



  /* ================================================================
     GRÁFICO NUEVO: DESGLOSE DETALLADO (SUNBURST)
     Jerarquía: Genérica -> Específica -> Subespecífica
     ================================================================ */
  _updateSunburst(rows, headers, metric) {
    const chart = this._charts['chart-sunburst'];
    if (!chart) return;

    const pIdx = headers.indexOf('Partida');
    const denomIdx = headers.indexOf('Denominacion');
    const metricIdx = headers.indexOf(metric);
    if (pIdx < 0 || denomIdx < 0 || metricIdx < 0) return;

    const hierarchy = {};

    rows.forEach(row => {
      const fullPartida = String(row[pIdx] || '').trim();
      const denom = String(row[denomIdx] || '').trim();
      const val = parseFloat(row[metricIdx]) || 0;
      if (!fullPartida || val <= 0) return;

      const parts = fullPartida.split('.');
      if (parts.length < 2) return;
      
      const genCode = parts[0] + '.' + parts[1]; // 4.01
      const genFullCode = genCode + '.00.00.00';
      const genDenom = (typeof DENOMINACIONES !== 'undefined' && DENOMINACIONES[genFullCode]) ? DENOMINACIONES[genFullCode] : '';
      const genLabel = genDenom ? `${genCode} ${genDenom.length > 20 ? genDenom.slice(0, 18) + '…' : genDenom}` : genCode;

      if (!hierarchy[genLabel]) hierarchy[genLabel] = { value: 0, children: {} };
      hierarchy[genLabel].value += val;

      if (denom) {
        // Truncar la denominación para que quepa en el gráfico
        const dLabel = denom.length > 30 ? denom.slice(0, 27) + '…' : denom;
        if (!hierarchy[genLabel].children[dLabel]) {
          hierarchy[genLabel].children[dLabel] = { value: 0 };
        }
        hierarchy[genLabel].children[dLabel].value += val;
      }
    });

    const buildData = (nodes) => {
      const result = [];
      for (const [name, node] of Object.entries(nodes)) {
        const item = { name, value: node.value };
        if (node.children && Object.keys(node.children).length > 0) {
          item.children = buildData(node.children);
        }
        result.push(item);
      }
      return result;
    };

    const data = buildData(hierarchy);

    if (data.length === 0) {
      chart.setOption({ title: { text: 'Sin datos', left: 'center', top: 'center', textStyle: { color: '#888' } }, series: [] }, true);
      return;
    }

    chart.setOption({
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(20,24,36,0.95)',
        borderColor: 'rgba(255,255,255,0.1)',
        textStyle: { color: '#e0e0e0', fontSize: 12 },
        confine: true,
        formatter: p => `<strong>Partida ${p.name}</strong><br/>${metric}: <strong>${this._fmtMoney(p.value)}</strong>`
      },
      series: [{
        type: 'sunburst',
        data: data,
        radius: [0, '95%'],
        sort: null,
        emphasis: {
            focus: 'ancestor'
        },
        levels: [
          {}, // Nivel 0 (Centro)
          { // Nivel 1: Partida Genérica
            r0: '10%',
            r: '45%',
            itemStyle: {
              borderWidth: 2,
              borderColor: '#141824'
            },
            label: {
              rotate: 'tangential',
              minAngle: 15, // Ocultar si es muy angosto
              color: '#ffffff',
              fontWeight: 'bold',
              fontSize: 11
            }
          },
          { // Nivel 2: Denominación
            r0: '45%',
            r: '90%',
            itemStyle: {
              borderWidth: 1,
              borderColor: '#141824'
            },
            label: {
              rotate: 'tangential',
              minAngle: 6, // Ocultar textos que se solaparían
              color: '#d0d4e0',
              fontSize: 10
            }
          }
        ]
      }],
      color: this._colors
    }, true);
  }

  /* ================================================================
     GRÁFICO 1: EVOLUCIÓN MENSUAL
     Qué cuenta: ¿Cómo se ha ido ejecutando el presupuesto mes a mes?
     ¿Hay meses pico? ¿La ejecución es constante o irregular?
     ================================================================ */
  _updateEvolucion(rows, headers, metric) {
    const chart = this._charts['chart-evolucion'];
    if (!chart) return;

    const fechaIdx = headers.indexOf('Fecha');
    const compIdx = headers.indexOf('Comprometido');
    const causIdx = headers.indexOf('Causado');
    const pagIdx = headers.indexOf('Pagado');

    // Agrupar por mes
    const mesesNombre = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
      'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const byMonth = {};

    rows.forEach(row => {
      const fecha = String(row[fechaIdx] || '');
      const parts = fecha.split('/');
      if (parts.length !== 3) return;
      const m = parseInt(parts[1]);
      if (m < 1 || m > 12) return;

      if (!byMonth[m]) byMonth[m] = { comp: 0, caus: 0, pag: 0 };
      byMonth[m].comp += parseFloat(row[compIdx]) || 0;
      byMonth[m].caus += parseFloat(row[causIdx]) || 0;
      byMonth[m].pag += parseFloat(row[pagIdx]) || 0;
    });

    // Construir arrays solo para los meses que existen
    const monthKeys = Object.keys(byMonth).map(Number).sort((a, b) => a - b);
    if (monthKeys.length === 0) {
      chart.setOption({ title: { text: 'Sin datos de fechas', left: 'center', top: 'center', textStyle: { color: '#888' } }, series: [] }, true);
      return;
    }

    const labels = monthKeys.map(m => mesesNombre[m - 1]);
    const compData = monthKeys.map(m => byMonth[m].comp);
    const causData = monthKeys.map(m => byMonth[m].caus);
    const pagData = monthKeys.map(m => byMonth[m].pag);

    // La serie activa se destaca, las demás se atenúan
    const seriesDef = [
      { key: 'Comprometido', data: compData, color: '#5B8FF9' },
      { key: 'Causado', data: causData, color: '#F6BD16' },
      { key: 'Pagado', data: pagData, color: '#5AD8A6' }
    ];

    const series = seriesDef.map(s => {
      const active = s.key === metric;
      return {
        name: s.key,
        type: 'bar',
        stack: null,
        data: s.data,
        barMaxWidth: 35,
        barGap: '20%',
        itemStyle: {
          color: active ? s.color : s.color + '40',
          borderRadius: [3, 3, 0, 0]
        },
        emphasis: {
          itemStyle: { color: s.color }
        }
      };
    });

    // Agregar línea de acumulado para la métrica activa
    let acumulado = 0;
    const acumData = seriesDef.find(s => s.key === metric).data.map(v => {
      acumulado += v;
      return acumulado;
    });

    series.push({
      name: `${metric} Acumulado`,
      type: 'line',
      data: acumData,
      smooth: true,
      symbol: 'circle',
      symbolSize: 6,
      lineStyle: { width: 3, color: '#FF6B81' },
      itemStyle: { color: '#FF6B81' },
      yAxisIndex: 1,
      z: 10
    });

    chart.setOption({
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(20,24,36,0.95)',
        borderColor: 'rgba(255,255,255,0.1)',
        textStyle: { color: '#e0e0e0', fontSize: 12 },
        confine: true,
        formatter: params => {
          let t = `<strong style="font-size:13px">${params[0].name}</strong><br/>`;
          params.forEach(p => {
            t += `${p.marker} ${p.seriesName}: <strong>${this._fmtMoney(p.value)}</strong><br/>`;
          });
          return t;
        }
      },
      legend: {
        data: ['Comprometido', 'Causado', 'Pagado', `${metric} Acumulado`],
        textStyle: { color: '#b0b4c0', fontSize: 11 },
        top: 5,
        itemGap: 15
      },
      grid: { top: 50, right: 70, bottom: 35, left: 70 },
      xAxis: {
        type: 'category',
        data: labels,
        axisLabel: { color: '#9a9eaa', fontSize: 12 },
        axisLine: { lineStyle: { color: '#444' } }
      },
      yAxis: [
        {
          type: 'value',
          name: 'Mensual',
          nameTextStyle: { color: '#888', fontSize: 10 },
          axisLabel: { color: '#9a9eaa', fontSize: 11, formatter: v => this._fmtShort(v) },
          splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
          splitNumber: 4
        },
        {
          type: 'value',
          name: 'Acumulado',
          nameTextStyle: { color: '#FF6B81', fontSize: 10 },
          axisLabel: { color: '#FF6B81', fontSize: 10, formatter: v => this._fmtShort(v) },
          splitLine: { show: false }
        }
      ],
      series,
      animationDuration: 800,
      animationEasing: 'cubicOut'
    }, true);
  }

  /* ================================================================
     GRÁFICO 2: DISTRIBUCIÓN POR PARTIDA
     Qué cuenta: ¿En qué se gasta el presupuesto?
     Muestra la composición del gasto por partida principal.
     ================================================================ */
  _updatePartidas(rows, headers, metric, filterState) {
    const chart = this._charts['chart-partidas'];
    if (!chart) return;

    // Actualizar título dinámico
    const titleEl = document.getElementById('title-chart-partidas');
    if (titleEl) {
      if (filterState && filterState.estructura) {
        // Usar solo el código (ej. AC1) o truncar
        const structCode = filterState.estructura.split(' ')[0] || filterState.estructura;
        titleEl.textContent = `Distribución por Partida (${structCode})`;
      } else {
        titleEl.textContent = `Distribución por Partida (Consolidado)`;
      }
    }

    const pIdx = headers.indexOf('Partida');
    const metricIdx = headers.indexOf(metric);
    if (pIdx < 0 || metricIdx < 0) return;

    // Agrupar por partida genérica (4.01, 4.02, etc.)
    const map = {};
    rows.forEach(row => {
      const fullPartida = String(row[pIdx] || '').trim();
      if (!fullPartida) return;
      // Extraer código genérico: "4.01.00.00.00" -> "4.01"
      const parts = fullPartida.split('.');
      const generic = parts.slice(0, 2).join('.');
      const val = parseFloat(row[metricIdx]) || 0;
      if (val <= 0) return;
      map[generic] = (map[generic] || 0) + val;
    });

    // Obtener denominaciones
    const entries = Object.entries(map)
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1]);

    if (entries.length === 0) {
      chart.setOption({ title: { text: 'Sin datos', left: 'center', top: 'center', textStyle: { color: '#888' } }, series: [] }, true);
      return;
    }

    const total = entries.reduce((s, [, v]) => s + v, 0);

    const data = entries.map(([code, value]) => {
      const fullCode = code + '.00.00.00';
      const denom = (typeof DENOMINACIONES !== 'undefined' && DENOMINACIONES[fullCode])
        ? DENOMINACIONES[fullCode]
        : code;
      // Nombre corto: "4.01 Personal" 
      const shortName = denom.length > 25
        ? `${code} ${denom.slice(0, 22)}…`
        : `${code} ${denom}`;
      const pct = ((value / total) * 100).toFixed(1);
      return { name: shortName, value, pct };
    });

    chart.setOption({
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(20,24,36,0.95)',
        borderColor: 'rgba(255,255,255,0.1)',
        textStyle: { color: '#e0e0e0', fontSize: 12 },
        confine: true,
        formatter: p => `<strong>${p.name}</strong><br/>${metric}: <strong>${this._fmtMoney(p.value)}</strong><br/>Proporción: ${p.data.pct}%`
      },
      legend: {
        type: 'scroll',
        orient: 'vertical',
        right: 5,
        top: 20,
        bottom: 20,
        textStyle: { color: '#b0b4c0', fontSize: 11, overflow: 'truncate', width: 140 },
        formatter: name => name.length > 20 ? name.slice(0, 18) + '…' : name,
        pageTextStyle: { color: '#888' },
        pageIconColor: '#5B8FF9',
        pageIconInactiveColor: '#555'
      },
      series: [{
        type: 'pie',
        radius: ['30%', '60%'],
        center: ['32%', '52%'],
        avoidLabelOverlap: true,
        padAngle: 2,
        itemStyle: { borderRadius: 6 },
        label: {
          show: true,
          position: 'outside',
          color: '#ccc',
          fontSize: 11,
          formatter: p => p.data.pct > 5 ? `${p.data.pct}%` : ''
        },
        labelLine: {
          show: true,
          length: 12,
          length2: 8,
          lineStyle: { color: '#666' }
        },
        emphasis: {
          label: { show: true, fontSize: 13, fontWeight: 'bold' },
          itemStyle: { shadowBlur: 15, shadowColor: 'rgba(0,0,0,0.4)' }
        },
        data,
        color: this._colors
      }],
      animationDuration: 1000,
      animationEasing: 'cubicOut'
    }, true);
  }

  /* ================================================================
     GRÁFICO 4: EJECUCIÓN POR ACCIÓN ESPECÍFICA
     Qué cuenta: ¿Qué áreas han gastado más vs lo presupuestado?
     Muestra barras comparativas (Actualizado vs Ejecutado) + % ejecución.
     ================================================================ */
  _updateAcciones(rows, headers, metric) {
    const chart = this._charts['chart-acciones'];
    if (!chart) return;

    const accIdx = headers.indexOf('Accion Especifica');
    const metricIdx = headers.indexOf(metric);
    if (accIdx < 0 || metricIdx < 0) return;

    // ---- BUDGET: calcular Monto Actualizado de TODOS los datos ---- //
    const rawData = dataManager.getAllRaw();
    const rawHeaders = rawData.headers;
    const rawRows = window.filterManager ? window.filterManager.getStructurallyFilteredData() : rawData.rows;
    const rawAccIdx = rawHeaders.indexOf('Accion Especifica');
    const rawActIdx = rawHeaders.indexOf('Monto Actualizado');
    const rawBlockIdIdx = rawHeaders.indexOf('ID Bloque');

    const map = {};
    const processedBlocks = new Set();

    rawRows.forEach(row => {
      const acc = String(row[rawAccIdx] || '').trim();
      const blockId = String(row[rawBlockIdIdx] || '').trim();
      if (!acc) return;
      if (!map[acc]) map[acc] = { actualizado: 0, ejecutado: 0 };

      if (blockId && !processedBlocks.has(blockId)) {
        processedBlocks.add(blockId);
        map[acc].actualizado += parseFloat(row[rawActIdx]) || 0;
      }
    });

    // ---- EXECUTION: calcular ejecutado de los datos FILTRADOS ---- //
    const cuentaIdx = headers.indexOf('Cuenta');
    rows.forEach(row => {
      const acc = String(row[accIdx] || '').trim();
      if (!acc) return;
      if (!map[acc]) map[acc] = { actualizado: 0, ejecutado: 0 };
      map[acc].ejecutado += parseFloat(row[metricIdx]) || 0;
    });

    // Ordenar por ejecutado y tomar top 6
    const sorted = Object.entries(map)
      .filter(([, v]) => v.actualizado > 0 || v.ejecutado > 0)
      .sort((a, b) => b[1].ejecutado - a[1].ejecutado)
      .slice(0, 6)
      .reverse(); // Barras horizontales

    if (sorted.length === 0) {
      chart.setOption({ title: { text: 'Sin acciones', left: 'center', top: 'center', textStyle: { color: '#888' } }, series: [] }, true);
      return;
    }

    const labels = sorted.map(([k]) => k.length > 25 ? k.slice(0, 23) + '…' : k);
    const actData = sorted.map(([, v]) => v.actualizado);
    const ejData = sorted.map(([, v]) => v.ejecutado);
    const pctData = sorted.map(([, v]) => v.actualizado > 0
      ? Math.round((v.ejecutado / v.actualizado) * 100) : 0);

    // Calcular margen para labels
    const maxLabelLen = Math.max(...labels.map(l => l.length));
    const leftMargin = Math.min(Math.max(maxLabelLen * 6.5, 80), 200);

    chart.setOption({
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: 'rgba(20,24,36,0.95)',
        borderColor: 'rgba(255,255,255,0.1)',
        textStyle: { color: '#e0e0e0', fontSize: 12 },
        confine: true,
        formatter: params => {
          const orig = sorted[params[0].dataIndex];
          if (!orig) return '';
          const pct = orig[1].actualizado > 0
            ? ((orig[1].ejecutado / orig[1].actualizado) * 100).toFixed(1) : '0.0';
          let t = `<strong>${orig[0]}</strong><br/>`;
          params.forEach(p => {
            if (p.seriesName !== '% Ejecución') {
              t += `${p.marker} ${p.seriesName}: <strong>${this._fmtMoney(p.value)}</strong><br/>`;
            }
          });
          t += `📊 Ejecución: <strong>${pct}%</strong>`;
          return t;
        }
      },
      legend: {
        data: ['Ppto. Actualizado', `${metric}`, '% Ejecución'],
        textStyle: { color: '#b0b4c0', fontSize: 11 },
        top: 5,
        itemGap: 15
      },
      grid: { top: 48, right: 60, bottom: 20, left: leftMargin },
      xAxis: [
        {
          type: 'value',
          axisLabel: { color: '#9a9eaa', fontSize: 10, formatter: v => this._fmtShort(v) },
          splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
          splitNumber: 4
        },
        {
          type: 'value',
          max: 100,
          show: false
        }
      ],
      yAxis: {
        type: 'category',
        data: labels,
        axisLabel: { color: '#d0d4e0', fontSize: 10, overflow: 'truncate', width: leftMargin - 10 },
        axisLine: { show: false },
        axisTick: { show: false }
      },
      series: [
        {
          name: 'Ppto. Actualizado',
          type: 'bar',
          data: actData,
          barWidth: '35%',
          itemStyle: { color: this._colors[0] + '88', borderRadius: [0, 3, 3, 0] },
          barGap: '5%'
        },
        {
          name: metric,
          type: 'bar',
          data: ejData,
          barWidth: '35%',
          itemStyle: { color: this._colors[1], borderRadius: [0, 3, 3, 0] }
        },
        {
          name: '% Ejecución',
          type: 'scatter',
          data: pctData,
          xAxisIndex: 1,
          symbol: 'diamond',
          symbolSize: 12,
          itemStyle: { color: '#FF6B81' },
          label: {
            show: true,
            position: 'right',
            color: '#FF6B81',
            fontSize: 11,
            fontWeight: 'bold',
            formatter: p => p.value + '%'
          }
        }
      ],
      animationDuration: 800,
      animationEasing: 'cubicOut'
    }, true);
  }

  /* ================================================================
     GRÁFICO 5: COMPARATIVO PRESUPUESTO VS EJECUTADO
     Qué cuenta: ¿Dónde hay sub-ejecución o sobre-ejecución?
     Las barras muestran la brecha entre lo presupuestado y lo ejecutado.
     ================================================================ */
  _updateComparativoEstructura(rows, headers) {
    this._updateComparativoMulti(rows, headers, 'Estructura Programatica', 'chart-comparativo-estructura');
  }

  _updateComparativoPartida(rows, headers) {
    this._updateComparativoMulti(rows, headers, 'Partida', 'chart-comparativo-partida');
  }

  _updateComparativoMulti(rows, headers, categoryCol, chartId) {
    const chart = this._charts[chartId];
    if (!chart) return;

    const catIdx = headers.indexOf(categoryCol);
    if (catIdx < 0) return;

    // ---- BUDGET: calcular Monto Actualizado de TODOS los datos ---- //
    const rawData = dataManager.getAllRaw();
    const rawHeaders = rawData.headers;
    const rawRows = window.filterManager ? window.filterManager.getStructurallyFilteredData() : rawData.rows;
    const rawCatIdx = rawHeaders.indexOf(categoryCol);
    const rawActIdx = rawHeaders.indexOf('Monto Actualizado');
    const rawBlockIdIdx = rawHeaders.indexOf('ID Bloque');

    const map = {};
    const processedBlocks = new Set();

    rawRows.forEach(row => {
      const c = String(row[rawCatIdx] || '').trim();
      const blockId = String(row[rawBlockIdIdx] || '').trim();
      if (!c) return;
      if (!map[c]) map[c] = { actualizado: 0, comprometido: 0, causado: 0, pagado: 0 };

      if (blockId && !processedBlocks.has(blockId)) {
        processedBlocks.add(blockId);
        map[c].actualizado += parseFloat(row[rawActIdx]) || 0;
      }
    });

    // ---- EXECUTION: calcular ejecutado de los datos FILTRADOS ---- //
    const compIdx = headers.indexOf('Comprometido');
    const causIdx = headers.indexOf('Causado');
    const pagIdx = headers.indexOf('Pagado');

    rows.forEach(row => {
      const c = String(row[catIdx] || '').trim();
      if (!c) return;
      if (!map[c]) map[c] = { actualizado: 0, comprometido: 0, causado: 0, pagado: 0 };
      if (compIdx >= 0) map[c].comprometido += parseFloat(row[compIdx]) || 0;
      if (causIdx >= 0) map[c].causado += parseFloat(row[causIdx]) || 0;
      if (pagIdx >= 0) map[c].pagado += parseFloat(row[pagIdx]) || 0;
    });

    // Filtrar bloques sin movimiento
    let top = Object.entries(map)
      .filter(([, v]) => v.actualizado > 0 || v.comprometido > 0 || v.causado > 0 || v.pagado > 0);

    // Ordenar: Alfanumérico si es Partida, o por presupuesto si es Estructura
    if (categoryCol === 'Partida') {
      top.sort((a, b) => a[0].localeCompare(b[0]));
    } else {
      top.sort((a, b) => b[1].actualizado - a[1].actualizado);
    }
    
    top = top.slice(0, 15);

    if (top.length === 0) {
      chart.setOption({ title: { text: 'Sin datos', left: 'center', top: 'center', textStyle: { color: '#888' } }, series: [] }, true);
      return;
    }

    // Si es Partida, agregar Denominación al nombre base para que el tooltip lo muestre completo
    if (categoryCol === 'Partida') {
        top = top.map(([k, v]) => {
           const parts = k.split('.');
           const gen = parts.slice(0, 2).join('.');
           let denom = k;
           if (typeof DENOMINACIONES !== 'undefined' && DENOMINACIONES[gen]) {
               denom = `${k} - ${DENOMINACIONES[gen]}`;
           }
           return [denom, v];
        });
    }

    const labels = top.map(([k]) => k.length > 40 ? k.slice(0, 38) + '…' : k);

    const actData = top.map(([, v]) => v.actualizado);
    const compData = top.map(([, v]) => v.comprometido);
    const causData = top.map(([, v]) => v.causado);
    const pagData = top.map(([, v]) => v.pagado);

    chart.setOption({
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: 'rgba(20,24,36,0.95)',
        borderColor: 'rgba(255,255,255,0.1)',
        textStyle: { color: '#e0e0e0', fontSize: 12 },
        confine: true,
        formatter: params => {
          const idx = params[0].dataIndex;
          const orig = top[idx];
          if (!orig) return '';
          let t = `<strong style="font-size:12px">${orig[0]}</strong><br/>`;
          t += `📋 Ppto. Actualizado: <strong style="color: ${this._colors[0]}">${this._fmtMoney(orig[1].actualizado)}</strong><br/>`;
          t += `📝 Comprometido: <strong style="color: ${this._colors[2]}">${this._fmtMoney(orig[1].comprometido)}</strong><br/>`;
          t += `✅ Causado: <strong style="color: ${this._colors[1]}">${this._fmtMoney(orig[1].causado)}</strong><br/>`;
          t += `💵 Pagado: <strong style="color: ${this._colors[3]}">${this._fmtMoney(orig[1].pagado)}</strong><br/>`;
          return t;
        }
      },
      legend: {
        data: ['Actualizado', 'Comprometido', 'Causado', 'Pagado'],
        textStyle: { color: '#b0b4c0', fontSize: 11 },
        top: 0,
        itemGap: 15
      },
      grid: { top: 40, right: 10, bottom: 90, left: 70 },
      xAxis: {
        type: 'category',
        data: labels,
        axisLabel: {
          color: '#9a9eaa',
          fontSize: 10,
          rotate: 35,
          interval: 0,
          overflow: 'truncate',
          width: 90
        },
        axisLine: { lineStyle: { color: '#444' } }
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: '#9a9eaa', fontSize: 11, formatter: v => this._fmtShort(v) },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
      },
      series: [
        {
          name: 'Actualizado',
          type: 'bar',
          data: actData,
          barMaxWidth: 15,
          itemStyle: { color: this._colors[0], borderRadius: [2, 2, 0, 0] }
        },
        {
          name: 'Comprometido',
          type: 'bar',
          data: compData,
          barMaxWidth: 15,
          itemStyle: { color: this._colors[2], borderRadius: [2, 2, 0, 0] }
        },
        {
          name: 'Causado',
          type: 'bar',
          data: causData,
          barMaxWidth: 15,
          itemStyle: { color: this._colors[1], borderRadius: [2, 2, 0, 0] }
        },
        {
          name: 'Pagado',
          type: 'bar',
          data: pagData,
          barMaxWidth: 15,
          itemStyle: { color: this._colors[3], borderRadius: [2, 2, 0, 0] }
        }
      ],
      animationDuration: 1000,
      animationEasing: 'cubicOut'
    }, true);
  }

  /* ================================================================
     UTILIDADES
     ================================================================ */

  resize() {
    Object.values(this._charts).forEach(c => c.resize());
  }

  destroy() {
    Object.values(this._charts).forEach(c => c.dispose());
    this._charts = {};
    this._initialized = false;
  }

  /**
   * Formato de moneda completo: 1.257.336,00
   */
  _fmtMoney(v) {
    if (!v && v !== 0) return '0,00';
    return Number(v).toLocaleString('es-VE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  /**
   * Formato abreviado para ejes (sin decimales pero sin simplificar con letras)
   */
  _fmtShort(v) {
    if (v === 0 || v === null || v === undefined) return '0';
    return Number(v).toLocaleString('es-VE', { maximumFractionDigits: 0 });
  }
}

const dashboard = new Dashboard();
window.dashboard = dashboard;
