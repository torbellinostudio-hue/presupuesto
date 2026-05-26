const XLSX = require('xlsx');

const file = 'mayor_analitico.xls';
const wb = XLSX.readFile(file);
const ws = wb.Sheets[wb.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false });

let currentEP = '';
let currentAcc = '';
let currentCuenta = '';

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

  const key = `${currentEP}|${currentAcc}|${currentCuenta}`;
  if (key === ' Organización, reconocimiento y memoria para celebrar el bicentenario de la Batalla Naval del Lago|COORDINACION GENERAL DE OPERACIONES|402010100                ') {
      console.log(`Row ${i}: ${JSON.stringify(row)}`);
  }
}
