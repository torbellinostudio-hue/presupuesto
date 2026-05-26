const XLSX = require('xlsx');
const wb = XLSX.readFile('spg_mayor_analitico(4).xls');
const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false });
for (let i = 0; i < 500; i++) {
  if (String(data[i]?.[0]).trim() === 'Estructura Programatica') {
    console.log('FOUND AT ROW', i);
    for (let j=0; j<8; j++) console.log('ROW', i+j, 'col0:', data[i+j]?.[0]);
    break;
  }
}
