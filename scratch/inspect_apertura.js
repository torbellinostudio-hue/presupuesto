const XLSX = require('xlsx');
const wb = XLSX.readFile('spg_mayor_analitico(4).xls');
const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false });

for (let i = 3690; i < 3750; i++) {
  const row = data[i] || [];
  const text = row.join(' | ').toLowerCase();
  if (text.includes('apertura')) {
    console.log('FOUND APERTURA AT ROW', i);
    console.log(row);
  }
}
