/* ================================================================
   CONFIG.JS — Configuración general de la aplicación
   ================================================================
   Este archivo centraliza todas las constantes y parámetros
   ajustables. Para añadir nuevas funcionalidades, registra aquí
   los módulos y configuraciones necesarias.
   ================================================================ */

const APP_CONFIG = Object.freeze({

  /* ------------------------------------------------------------
     VERSIÓN DE LA APLICACIÓN
  */
  version: '2.0.0',

  /* ------------------------------------------------------------
     COLUMNAS DEL ARCHIVO ORIGINAL (MAYOR PRESUPUESTARIO)
     Mapeo de índices según la estructura del Excel
  */
  sourceColumns: {
    ESTRUCTURA_PROGRAMATICA: 0,     // Col A
    ACCION_ESPECIFICA: 1,           // Col B
    CUENTA: 2,                      // Col C
    DENOMINACION: 3,                // Col D
    FECHA: 4,                       // Col E
    COMPROBANTE: 5,                 // Col F
    DOCUMENTO: 6,                   // Col G
    PROCEDE: 7,                     // Col H
    PROVEEDOR: 8,                   // Col I
    DETALLE: 9,                     // Col J
    ASIGNADO: 10,                   // Col K
    AUMENTO: 11,                    // Col L
    DISMINUCION: 12,                // Col M
    MONTO_ACTUALIZADO: 13,          // Col N
    PRE_COMPROMETIDO: 14,           // Col O
    COMPROMETIDO: 15,               // Col P
    CAUSADO: 16,                    // Col Q
    PAGADO: 17,                     // Col R
    POR_PAGAR: 18                   // Col S
  },

  /* ------------------------------------------------------------
     COLUMNAS DE SALIDA (datos transformados)
  */
  outputColumns: [
    'Estructura Programatica',
    'Accion Especifica',
    'Unidad Ejecutora',
    'Partida',
    'Generica',
    'Especifica',
    'Sub-especifica',
    'Cuenta',
    'Denominacion',
    'Fecha',
    'Comprobante',
    'Documento',
    'Procede',
    'Proveedor/Beneficiario',
    'Detalle',
    'Asignado',
    'Aumento',
    'Disminucion',
    'Modificación',
    'Monto Actualizado',
    'Pre Comprometido',
    'Comprometido',
    'Causado',
    'Pagado',
    'Por Pagar',
    'ID Bloque'
  ],

  /* ------------------------------------------------------------
     CLAVES PARA IDENTIFICAR FILAS ESPECIALES EN EL EXCEL
  */
  markers: {
    ESTRUCTURA_PROGRAMATICA: 'Estructura Programatica',
    CUENTA: 'Cuenta',
    FECHA_SEPARATOR: '/',         // Las filas con fecha tienen "/"
    SALDOS_ANTERIORES: 'SALDOS ANTERIORES'
  },

  /* ------------------------------------------------------------
     CONFIGURACIÓN DE TABLA (Tabulator)
  */
  table: {
    rowsPerPage: 50,
    maxVisibleColumns: 24
  },

  /* ------------------------------------------------------------
     CONFIGURACIÓN DE GRÁFICOS (ECharts)
  */
  charts: {
    colorPalette: [
      '#5B8FF9', '#5AD8A6', '#F6BD16', '#E8684A', '#B37FEB',
      '#5DC0CF', '#FF9845', '#6DC8EC', '#FF6B81', '#9270CA',
      '#269A99', '#FF9EC6', '#43A047', '#D4E157', '#78909C'
    ]
  },

  /* ------------------------------------------------------------
     CONFIGURACIÓN DE KPIs
  */
  kpis: {
    animationDuration: 1200,
    abbreviation: {
      million: 'M',
      thousand: 'K'
    }
  },

  /* ------------------------------------------------------------
     REGISTRO DE MÓDULOS
     ------------------------------------------------------------
     Para añadir un nuevo módulo:
       1. Crea el archivo en js/
       2. Añade una entrada aquí con nombre y ruta
       3. Añade el <script> en index.html
  */
  modules: [
    { name: 'excel-processor', path: 'js/excel-processor.js' },
    { name: 'data-manager', path: 'js/data-manager.js' },
    { name: 'data-aggregator', path: 'js/data-aggregator.js' },
    { name: 'aggregator-ui', path: 'js/aggregator-ui.js' },
    { name: 'filter-manager', path: 'js/filter-manager.js' },
    { name: 'kpi-manager', path: 'js/kpi-manager.js' },
    { name: 'dashboard', path: 'js/dashboard.js' },
    { name: 'analysis-manager', path: 'js/analysis-manager.js' },
    { name: 'ui-controller', path: 'js/ui-controller.js' }
  ]
});

/* Exportación global para acceso desde otros módulos */
window.APP_CONFIG = APP_CONFIG;
