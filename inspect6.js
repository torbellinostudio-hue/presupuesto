const XLSX = require('xlsx');

const file = 'mayor_analitico.xls';
const wb = XLSX.readFile(file);
const ws = wb.Sheets[wb.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false });

let currentEP = '';
let currentAcc = '';
let currentCuenta = '';

const budgetKeys = new Set();
let totalSumKeys = 0;
let totalSumAll = 0;

for (let i = 0; i < data.length; i++) {
  const row = data[i];
  const col0 = String(row[0] || '').trim();

  if (col0 === 'Estructura Programatica') {
    currentEP = String(data[i+1]?.[0] || '').trim();
    currentAcc = String(data[i+3]?.[0] || '').trim();
  }

  if (col0 === 'Cuenta') {
    currentCuenta = String(row[1] || '').trim();
  }

  // Check if it's APERTURA
  if (String(row[3] || '').includes('APERTURA') || String(row[2] || '').includes('APERTURA')) {
    const strAsig = String(row[4] || '').replace(/,/g, '');
    const numAsig = parseFloat(strAsig);
    if (!isNaN(numAsig) && numAsig > 0) {
        totalSumAll += numAsig;
        
        const key = `${currentEP}|${currentAcc}|${currentCuenta}`;
        if (!budgetKeys.has(key)) {
            budgetKeys.add(key);
            totalSumKeys += numAsig;
        } else {
            console.log(`DUPLICATE BUDGET KEY: ${key}`);
            console.log(`Value skipped: ${numAsig}`);
        }
    }
  }
}

console.log('Total sum (all APERTURA):', totalSumAll);
console.log('Total sum (unique Keys):', totalSumKeys);
