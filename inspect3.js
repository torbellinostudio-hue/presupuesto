const XLSX = require('xlsx');

const file = 'MAYOR_FMC_2025.xls';
const wb = XLSX.readFile(file);
const ws = wb.Sheets[wb.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false });

const totals = { '401': 0, '402': 0, '403': 0, '404': 0, '407': 0 };

let currentCuenta = '';
let currentGeneric = '';

for (let i = 0; i < data.length; i++) {
  const row = data[i];
  const col0 = String(row[0] || '').trim();

  if (col0 === 'Cuenta') {
    currentCuenta = String(row[1] || '').trim().replace(/[^0-9]/g, '');
    currentGeneric = currentCuenta.substring(0, 3); // e.g. 401
  }

  // Check if it's APERTURA
  if (String(row[3] || '').includes('APERTURA') || String(row[5] || '').includes('APERTURA') || String(row[2] || '').includes('APERTURA') || String(row[1] || '').includes('APERTURA')) {
    let asig = 0;
    for (let c = 0; c < row.length; c++) {
      const val = parseFloat(String(row[c]).replace(/,/g, ''));
      if (val > 100) { // Guessing the Asignado is the large number
        asig = Math.max(asig, val);
      }
    }
    // more precise Asignado
    const strAsig = String(row[6] || row[4] || '').replace(/,/g, '');
    const numAsig = parseFloat(strAsig);
    if (!isNaN(numAsig) && numAsig > 0) {
        if (totals[currentGeneric] !== undefined) {
            totals[currentGeneric] += numAsig;
        }
    }
  }
}

console.log('Totals by generic (FMC 2025):', totals);
