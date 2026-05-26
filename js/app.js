/* ================================================================
   APP.JS — Orquestador principal del Dashboard
   ================================================================ */

const App = {
  async init() {
    console.log(
      '%c📊 Dashboard de Ejecución Presupuestaria v' + APP_CONFIG.version,
      'font-size: 16px; font-weight: bold; color: #5B8FF9; padding: 8px 0;'
    );

    this._checkDependencies();
    this._loadDenominaciones();

    // Resize handler para gráficos de análisis
    window.addEventListener('resize', () => {
      if (typeof analysisManager !== 'undefined') {
        analysisManager.resize();
      }
    });

    console.log(
      '%c✅ Aplicación lista. Arrastra un archivo Excel para comenzar.',
      'color: #5AD8A6; font-size: 12px;'
    );
  },

  _loadDenominaciones() {
    if (typeof DENOMINACIONES !== 'undefined') {
      const total = Object.keys(DENOMINACIONES).length;
      console.log(`📖 Denominaciones cargadas: ${total} partidas/genéricas/específicas`);
    } else {
      console.warn('⚠️ Denominaciones no disponibles.');
    }
  },

  _checkDependencies() {
    const deps = {
      'XLSX (SheetJS)': typeof XLSX !== 'undefined',
      'ECharts': typeof echarts !== 'undefined',
      'Tabulator': typeof Tabulator !== 'undefined',
      'APP_CONFIG': typeof APP_CONFIG !== 'undefined',
      'DataManager': typeof dataManager !== 'undefined',
      'DataAggregator': typeof dataAggregator !== 'undefined',
      'AggregatorUI': typeof aggregatorUI !== 'undefined',
      'ExcelProcessor': typeof excelProcessor !== 'undefined',
      'FilterManager': typeof filterManager !== 'undefined',
      'KPIManager': typeof kpiManager !== 'undefined',
      'Dashboard': typeof dashboard !== 'undefined',
      'AnalysisManager': typeof analysisManager !== 'undefined',
      'UIController': typeof uiController !== 'undefined'
    };

    const allOk = Object.values(deps).every(v => v === true);
    if (allOk) {
      console.log('%c✅ Todas las dependencias cargadas correctamente.', 'color: #5AD8A6;');
    } else {
      const missing = Object.entries(deps)
        .filter(([, loaded]) => !loaded)
        .map(([name]) => name);
      console.warn('⚠️ Dependencias faltantes:', missing.join(', '));

      if (missing.some(m => ['XLSX (SheetJS)', 'ECharts', 'Tabulator'].includes(m))) {
        const body = document.querySelector('body');
        const warning = document.createElement('div');
        warning.className = 'toast toast-error';
        warning.style.cssText = 'position:fixed; top:20px; left:50%; transform:translateX(-50%); z-index:10000; max-width:600px; text-align:center;';
        warning.textContent = '⚠️ Dependencias faltantes: ' + missing.join(', ') + '. Verifica tu conexión a Internet y recarga la página.';
        body.prepend(warning);
      }
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
