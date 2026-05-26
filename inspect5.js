const XLSX = require('xlsx');

const file = 'mayor_analitico.xls';
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
    const strAsig = String(row[4] || row[6] || '').replace(/,/g, ''); // in mayor_analitico, Asignado is col 4
    const numAsig = parseFloat(strAsig);
    if (!isNaN(numAsig) && numAsig > 0) {
        if (totals[currentGeneric] !== undefined) {
            totals[currentGeneric] += numAsig;
        }
    }
  }
}

console.log('Totals by generic (mayor_analitico):', totals);
