const XLSX = require('xlsx');
const wb = XLSX.readFile('spg_mayor_analitico(4).xls');
const rawData = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false });

const shiftedData = rawData.map(row => ['', '', '', '', ...row]);

// Simulate _findColumnsDynamic
const map = { ep: 0, accion: 1, cuenta: 2, denominacion: 3 };
const regexMap = {
  fecha: /fecha/i,
  comprobante: /comprobante/i,
  documento: /documento|doc\.?/i,
  procede: /procede/i,
  proveedor: /proveedor|beneficiario/i,
  detalle: /detalle/i,
  asignado: /asignado|acordado/i,
  aumento: /aumento/i,
  disminucion: /disminuci[óo]n/i,
  montoAct: /actualizado/i,
  preComp: /pre\s*-?\s*comprometido/i,
  comp: /^comprometido$/i,
  causado: /causado/i,
  pagado: /pagado/i,
  porPagar: /por pagar/i
};

for (let i = 0; i < Math.min(200, shiftedData.length); i++) {
  const row = shiftedData[i];
  if (String(row[4] || '').trim() === 'Cuenta' && String(row[8] || '').trim().toLowerCase().includes('fecha')) {
    console.log('FOUND HEADER ROW AT', i);
    for (let c = 4; c < row.length; c++) {
      const title = String(row[c] || '').trim().toLowerCase();
      if (!title) continue;
      console.log('Header col', c, ':', title);
      for (const [key, regex] of Object.entries(regexMap)) {
        if (regex.test(title) && map[key] === undefined) {
          map[key] = c;
        }
      }
    }
    break;
  }
}
console.log('ColMap:', map);
