const XLSX = require('xlsx');
const file = 'mayor_analitico.xls';
const wb = XLSX.readFile(file);
const ws = wb.Sheets[wb.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false });

let currentBlockId = 0;
let totalAsignado = 0;
const processedBlocks = new Set();

for (let i = 0; i < data.length; i++) {
  const row = data[i];
  const col0 = String(row[0] || '').trim();

  if (col0 === 'Cuenta') {
    currentBlockId++;
  }

  const isApertura = String(row[3] || '').includes('APERTURA') || String(row[2] || '').includes('APERTURA');
  if (isApertura) {
      if (!processedBlocks.has(currentBlockId)) {
          processedBlocks.add(currentBlockId);
          const strAsig = String(row[4] || '').replace(/,/g, '');
          const numAsig = parseFloat(strAsig);
          if (!isNaN(numAsig) && numAsig > 0) {
              totalAsignado += numAsig;
          }
      }
  }
}

console.log('Total Asignado with blockId:', totalAsignado);
