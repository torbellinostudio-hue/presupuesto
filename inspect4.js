const XLSX = require('xlsx');

const file = 'MAYOR ANALITICO_ENERO A ABRIL 2026_CULTURA.xls';
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
    const strAsig = String(row[6] || row[4] || '').replace(/,/g, '');
    const numAsig = parseFloat(strAsig);
    if (!isNaN(numAsig) && numAsig > 0) {
        if (totals[currentGeneric] !== undefined) {
            totals[currentGeneric] += numAsig;
        }
    }
  }
}

console.log('Totals by generic (2026):', totals);
