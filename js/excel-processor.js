/* ================================================================
   EXCEL-PROCESSOR.JS - Lectura y transformacion de Excel (VERSIÓN DINÁMICA ROBUSTA)
   ================================================================ */

class ExcelProcessor {
  constructor() {
    this._markers = APP_CONFIG.markers;
  }

  async readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, {
            type: 'array',
            cellDates: true,
            dateNF: 'dd/mm/yyyy',
            raw: false
          });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const rawData = XLSX.utils.sheet_to_json(worksheet, {
            header: 1,
            defval: '',
            raw: false
          });
          const maxCols = rawData.reduce((max, row) => Math.max(max, row.length), 0);
          const normalizedData = rawData.map(row => {
            const newRow = [...row];
            while (newRow.length < maxCols) newRow.push('');
            return newRow;
          });
          resolve({
            workbook,
            sheetName,
            data: normalizedData,
            metadata: {
              fileName: file.name,
              fileSize: file.size,
              fileType: file.type || file.name.split('.').pop(),
              totalRawRows: normalizedData.length,
              totalRawCols: maxCols
            }
          });
        } catch (err) {
          reject(new Error('Error al leer el archivo: ' + err.message));
        }
      };
      reader.onerror = () => reject(new Error('Error al leer el archivo'));
      reader.readAsArrayBuffer(file);
    });
  }

  transform(rawData) {
    const { estructuras, cuentas } = this._extractHierarchy(rawData);
    // Agregamos 4 columnas al inicio para almacenar la jerarquía (EP, Accion, Cuenta, Denom)
    const shiftedData = rawData.map(row => ['', '', '', '', ...row]);
    this._assignEPValues(shiftedData, estructuras);
    this._assignCuentaValues(shiftedData, cuentas);

    // 1. Detectar dinámicamente en qué columnas están los montos y textos
    const colMap = this._findColumnsDynamic(shiftedData);

    // 2. Llenar hacia abajo los saldos de presupuesto
    this._fillDownDynamic(shiftedData, colMap);

    // 3. Filtrar solo las filas que sean transacciones (con fechas)
    const filteredRows = this._filterDateRowsDynamic(shiftedData, colMap);

    if (filteredRows.length === 0) {
      return { headers: [], rows: [], summary: {} };
    }
    const headers = APP_CONFIG.outputColumns;
    const rows = filteredRows.map(row => this._buildOutputRowDynamic(row, colMap));
    return {
      headers,
      rows,
      summary: {
        totalTransactions: rows.length,
        totalEstructuras: estructuras.length,
        totalCuentas: cuentas.length
      }
    };
  }

  _extractHierarchy(rawData) {
    const estructuras = [];
    const cuentas = [];
    let currentEP = '';
    let currentAccion = '';
    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i];
      const col0 = String(row[0] || '').trim();

      if (col0 === this._markers.ESTRUCTURA_PROGRAMATICA) {
        if (i + 1 < rawData.length) currentEP = String(rawData[i + 1][0] || '').trim();
        
        let candidate = String(rawData[i + 2]?.[0] || '').trim();
        let nextCandidate = String(rawData[i + 3]?.[0] || '').trim();
        
        // En los proyectos (PR), hay un nivel intermedio de "Acción" (ej. "ACC1")
        // y la "Acción Específica" real (ej. "003") está en la fila i+3.
        if (/^ACC\d+\b/i.test(candidate) || (/^PR\d*\b/i.test(currentEP) && /^\w{3,4}\b/.test(nextCandidate))) {
            currentAccion = nextCandidate;
        } else {
            currentAccion = candidate;
        }

        estructuras.push({
          rowIndex: i,
          programa: currentEP,
          accionCentral: String(rawData[i + 2]?.[0] || '').trim(),
          accionEspecifica: currentAccion
        });
      }

      if (col0 === this._markers.CUENTA) {
        // Extraer montos del presupuesto de la fila de cabecera si existen
        // Buscamos cualquier número a partir de la columna 3
        const budgetNums = [];
        for (let j = 3; j < row.length; j++) {
          const val = String(row[j] || '').replace(/[^0-9.,]/g, '').trim();
          if (val !== '' && /[0-9]/.test(val)) {
            budgetNums.push(val);
          }
        }

        cuentas.push({
          rowIndex: i,
          cuenta: String(row[1] || '').trim(),
          denominacion: String(row[2] || '').trim(),
          currentEP,
          currentAccion,
          // Si la cuenta tiene montos en la misma fila, los guardamos para usarlos después si hacen falta
          budgetAsignado: budgetNums.length > 0 ? budgetNums[0] : null,
          budgetMontoAct: budgetNums.length >= 4 ? budgetNums[3] : null
        });
      }
    }
    return { estructuras, cuentas };
  }

  _assignEPValues(shiftedData, estructuras) {
    for (let i = 0; i < shiftedData.length; i++) {
      const colE = String(shiftedData[i][4] || '').trim();
      if (colE === this._markers.ESTRUCTURA_PROGRAMATICA) {
        const ep = estructuras.find(e => e.rowIndex === i);
        if (ep) {
          // Escribir en las filas siguientes al marcador:
          // i+1 = fila del código de EP, i+2 = fila de la Acción Específica
          if (i + 1 < shiftedData.length && shiftedData[i + 1]) shiftedData[i + 1][0] = ep.programa;
          if (i + 2 < shiftedData.length && shiftedData[i + 2]) shiftedData[i + 2][1] = ep.accionEspecifica;
        }
      }
    }
  }

  _assignCuentaValues(shiftedData, cuentas) {
    let currentBlockId = 0;
    for (let i = 0; i < shiftedData.length; i++) {
      const colE = String(shiftedData[i][4] || '').trim();
      if (colE === this._markers.CUENTA) {
        currentBlockId++;
      }
      shiftedData[i]._blockId = currentBlockId;

      if (colE === this._markers.CUENTA) {
        const cuenta = cuentas.find(c => c.rowIndex === i);
        if (cuenta) {
          shiftedData[i][2] = cuenta.cuenta;
          shiftedData[i][3] = cuenta.denominacion;
          shiftedData[i][0] = cuenta.currentEP;
          shiftedData[i][1] = cuenta.currentAccion;
        }
      }
    }
  }

  _findColumnsDynamic(shiftedData) {
    // Mapa base predeterminado (con el desplazamiento de +4 ya incluido)
    const map = {
      fecha: 4, comprobante: 5, documento: 6, procede: 7, proveedor: 8, detalle: 9,
      asignado: 10, aumento: 11, disminucion: 12, montoAct: 13,
      preComp: 14, comp: 15, causado: 16, pagado: 17, porPagar: 18,
      _headerRowIndex: 8  // Valor por defecto: fila 8 (compatible con formato estándar)
    };

    // Escanear las primeras 20 filas para encontrar la fila de títulos reales
    let headerRow = null;
    for (let i = 0; i < Math.min(shiftedData.length, 20); i++) {
      if (!shiftedData[i]) continue;
      // Buscamos una fila que tenga al menos las columnas de 'fecha' y 'comprobante'
      const isHeader = shiftedData[i].some(cell => {
        const s = String(cell).toLowerCase().trim();
        return s === 'fecha' || s === 'comprobante' || s === 'proveedor';
      });
      if (isHeader) {
        headerRow = shiftedData[i];
        map._headerRowIndex = i;
        break;
      }
    }

    // Si encontramos la cabecera, remapeamos los índices inteligentemente
    if (headerRow) {
      // Limpiar los valores por defecto para no heredar índices fantasma
      Object.keys(map).forEach(k => {
        if (k !== '_headerRowIndex') map[k] = null;
      });

      // Las columnas reales empiezan a partir del índice 4
      for (let c = 4; c < headerRow.length; c++) {
        const title = String(headerRow[c]).toLowerCase().trim();
        if (!title) continue;

        if (title.includes('fecha')) map.fecha = c;
        else if (title.includes('comprobante')) map.comprobante = c;
        else if (title.includes('documento')) map.documento = c;
        else if (title.includes('procede')) map.procede = c;
        else if (title.includes('proveedor') || title.includes('benefic')) map.proveedor = c;
        else if (title.includes('detalle') || title.includes('descrip')) map.detalle = c;
        else if (title.includes('asignado') || title.includes('acordado')) map.asignado = c;
        else if (title.includes('aumento') || title.includes('incremento')) map.aumento = c;
        else if (title.includes('disminuci')) map.disminucion = c;
        else if (title.includes('actualizado') || title.includes('vigente')) map.montoAct = c;
        else if (title.includes('pre') && title.includes('comp')) map.preComp = c;
        else if (title.includes('comp')) map.comp = c;
        else if (title.includes('causado')) map.causado = c;
        else if (title.includes('pagado')) map.pagado = c;
        else if (title.includes('por pagar') || title.includes('deuda')) map.porPagar = c;
      }
    }

    return map;
  }

  _fillDownDynamic(shiftedData, colMap) {
    // Aumento y Disminucion son transaccionales (se suman), por lo que NO se arrastran
    const budgetCols = [colMap.asignado, colMap.montoAct];

    const toNum = (val) => {
      if (!val) return 0;
      let str = String(val).replace(/[^0-9.,\-]/g, '');
      if (!str) return 0;
      if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
        str = str.replace(/\./g, '').replace(',', '.');
      } else {
        str = str.replace(/,/g, '');
      }
      return parseFloat(str) || 0;
    };

    for (let i = 4; i < shiftedData.length; i++) {
      if (!shiftedData[i] || !shiftedData[i - 1]) continue;
      const sameBlock = shiftedData[i]._blockId === shiftedData[i - 1]._blockId;

      // 1. Arrastrar jerarquía solo dentro del mismo bloque
      if (sameBlock) {
        if (shiftedData[i][0] === '') shiftedData[i][0] = shiftedData[i - 1][0];
        if (shiftedData[i][1] === '') shiftedData[i][1] = shiftedData[i - 1][1];
        if (shiftedData[i][2] === '') shiftedData[i][2] = shiftedData[i - 1][2];
        if (shiftedData[i][3] === '') shiftedData[i][3] = shiftedData[i - 1][3];
      }

      // 2. Arrastrar montos presupuestarios si la celda de la transacción está vacía o es texto
      for (const c of budgetCols) {
        if (!c) continue;
        const cellVal = String(shiftedData[i][c] || '').trim();
        const prevVal = sameBlock ? String(shiftedData[i - 1][c] || '').trim() : '';
        
        const currentNum = toNum(cellVal);
        const prevNum = toNum(prevVal);

        if (sameBlock && (cellVal === '' || !/[0-9]/.test(cellVal) || (currentNum === 0 && prevNum !== 0))) {
          shiftedData[i][c] = shiftedData[i - 1][c];
        }
      }
    }
  }

  _filterDateRowsDynamic(shiftedData, colMap) {
    const headerIdx = (colMap._headerRowIndex !== undefined) ? colMap._headerRowIndex : 8;

    // Etiquetar la fila de cabecera con nombres de columna jerárquicos
    if (shiftedData.length > headerIdx) {
      shiftedData[headerIdx][0] = 'Estructura Programatica';
      shiftedData[headerIdx][1] = 'Accion Especifica';
      shiftedData[headerIdx][2] = 'Cuenta';
      shiftedData[headerIdx][3] = 'Denominacion';
    }
    const result = [];
    const dateRegex = /^\s*\d{1,4}[\/\-]\d{1,2}[\/\-]\d{1,4}/;
    // Los datos empiezan después de la fila de cabecera
    const dataStart = headerIdx + 1;

    for (let i = dataStart; i < shiftedData.length; i++) {
      // Validamos si la columna de fecha (detectada dinámicamente) tiene realmente una fecha
      const fechaCell = String(shiftedData[i][colMap.fecha] || '').trim();

      // Alternativa: Buscar en varias columnas cercanas por si acaso
      let isDateRow = dateRegex.test(fechaCell) || fechaCell.includes('/');

      if (!isDateRow) {
        // Fallback seguro: revisar si hay alguna fecha en las 5 primeras columnas originales
        for (let c = 4; c <= 8; c++) {
          const fallbackCell = String(shiftedData[i][c] || '').trim();
          if (dateRegex.test(fallbackCell) || fallbackCell.includes(this._markers.FECHA_SEPARATOR)) {
            isDateRow = true;
            break;
          }
        }
      }

      if (isDateRow) {
        result.push(shiftedData[i]);
      }
    }
    return result;
  }

  _buildOutputRowDynamic(row, colMap) {
    let ep = String(row[0] || '').trim();
    
    // ---- NORMALIZADOR DE VERSIONES (Validador de prefijos) ----
    // Si la Estructura Programática no tiene el código "AC" o "PR" al inicio, 
    // se lo inyectamos basándonos en palabras clave para estandarizar 
    // la compatibilidad con los KPIs y agrupaciones de todas las versiones.
    if (ep && !/^(AC|PR)\d*\b/i.test(ep)) {
      const epl = ep.toLowerCase();
      if (epl.includes('direccion y coordinacion') || epl.includes('gastos de personal') || epl.includes('trabajadores')) {
        ep = 'AC1 ' + ep;
      } else if (epl.includes('administracion') || epl.includes('administrativa') || epl.includes('apoyo institucional')) {
        ep = 'AC2 ' + ep;
      } else if (epl.includes('prevision') || epl.includes('mitigacion') || epl.includes('proteccion')) {
        ep = 'AC3 ' + ep;
      } else {
        ep = 'PR1 ' + ep; // Fallback por defecto a Proyecto 1
      }
    }

    const acc = String(row[1] || '').trim();
    const cuenta = String(row[2] || '').trim();
    const denom = String(row[3] || '').trim();

    // Función de parseo numérico a prueba de balas
    const toNum = (val) => {
      if (val === '' || val === null || val === undefined) return 0;
      let str = String(val).trim();
      if (!isNaN(parseFloat(str)) && isFinite(str)) return parseFloat(str);
      str = str.replace(/[^0-9.,\-]/g, '');
      if (!str) return 0;
      const ultimoPunto = str.lastIndexOf('.');
      const ultimaComa = str.lastIndexOf(',');
      if (ultimoPunto === -1 && ultimaComa === -1) return parseFloat(str) || 0;
      if (ultimaComa > ultimoPunto) {
        str = str.replace(/\./g, '');
        str = str.replace(',', '.');
      } else {
        str = str.replace(/,/g, '');
      }
      const num = parseFloat(str);
      return isNaN(num) ? 0 : num;
    };

    const asignado = toNum(row[colMap.asignado]);
    const aumento = toNum(row[colMap.aumento]);
    const disminucion = toNum(row[colMap.disminucion]);
    const modificacion = aumento - disminucion;
    const montoAct = toNum(row[colMap.montoAct]);

    const preComp = colMap.preComp ? toNum(row[colMap.preComp]) : 0;
    const comp = toNum(row[colMap.comp]);
    const causado = toNum(row[colMap.causado]);
    const pagado = toNum(row[colMap.pagado]);
    const porPagar = colMap.porPagar ? toNum(row[colMap.porPagar]) : 0;

    // Desglose de cuenta
    const limpia = cuenta.replace(/[^0-9]/g, '');
    const t = limpia.slice(0, 1);
    const p1 = limpia.slice(1, 3);
    const p2 = limpia.slice(3, 5);
    const p3 = limpia.slice(5, 7);
    const p4 = limpia.slice(7, 9);
    const partida = t + '.' + p1 + '.00.00.00';
    const generica = t + '.' + p1 + '.' + p2 + '.00.00';
    const especifica = t + '.' + p1 + '.' + p2 + '.' + p3 + '.00';
    const subespec = limpia.length >= 9 ? t + '.' + p1 + '.' + p2 + '.' + p3 + '.' + p4 : '';

    return [
      ep, acc, partida, generica, especifica, subespec,
      cuenta, denom,
      String(row[colMap.fecha] || '').trim(),
      String(row[colMap.comprobante] || '').trim(),
      colMap.documento ? String(row[colMap.documento] || '').trim() : '',
      colMap.procede ? String(row[colMap.procede] || '').trim() : '',
      colMap.proveedor ? String(row[colMap.proveedor] || '').trim() : '',
      colMap.detalle ? String(row[colMap.detalle] || '').trim() : '',
      asignado, aumento, disminucion, modificacion, montoAct,
      preComp, comp, causado, pagado, porPagar, row._blockId
    ];
  }

  async process(file) {
    const result = await this.readFile(file);
    const transformed = this.transform(result.data);
    return {
      headers: transformed.headers,
      rows: transformed.rows,
      metadata: result.metadata,
      summary: { ...result.metadata, ...transformed.summary }
    };
  }
}

const excelProcessor = new ExcelProcessor();
window.excelProcessor = excelProcessor;
