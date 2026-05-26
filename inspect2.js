const XLSX = require('xlsx');

const file = 'MAYOR ANALITICO_ENERO A ABRIL 2026_CULTURA.xls';
const wb = XLSX.readFile(file);
const ws = wb.Sheets[wb.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false });

let totalAsigCuentas = 0;
let totalAsigKeys = 0;
const cuentas = new Set();
const keys = new Set();

let currentEP = '';
let currentAcc = '';
let currentAsig = 0;

for (let i = 0; i < data.length; i++) {
  const row = data[i];
  const col0 = String(row[0] || '').trim();

  if (col0 === 'Estructura Programatica') {
    currentEP = String(data[i+1]?.[0] || '').trim();
    currentAcc = String(data[i+3]?.[0] || '').trim();
  }

  if (col0 === 'Cuenta') {
    const cuenta = String(row[1] || '').trim();
    
    // Find budget in Apertura
    let asig = 0;
    // We can just scan the next few rows for "APERTURA DE CUENTAS"
    for (let j = i+1; j < Math.min(i+10, data.length); j++) {
      if (String(data[j]?.[3] || '').includes('APERTURA')) {
         asig = parseFloat(String(data[j][4]).replace(/,/g, '')) || parseFloat(String(data[j][7]).replace(/,/g, '')) || 0;
         break;
      }
    }
    
    if (cuenta && !cuentas.has(cuenta)) {
      cuentas.add(cuenta);
      totalAsigCuentas += asig;
    }

    const key = `${currentEP}|${currentAcc}|${cuenta}`;
    if (key && !keys.has(key)) {
      keys.add(key);
      totalAsigKeys += asig;
    }
  }
}

console.log('Total Asignado (solo por cuenta):', totalAsigCuentas);
console.log('Total Asignado (por EP|ACC|Cuenta):', totalAsigKeys);
