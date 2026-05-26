const XLSX = require('xlsx');

const files = [
  'MAYOR ANALITICO_ENERO A ABRIL 2026_CULTURA.xls',
  'MAYOR_FMC_2025.xls',
  'mayor_analitico.xls'
];

files.forEach(f => {
  console.log(`\n=== FILE: ${f} ===`);
  try {
    const wb = XLSX.readFile(f);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false });
    for (let i = 3; i < 9; i++) {
      if (data[i]) console.log(`Row ${i}:`, JSON.stringify(data[i]));
    }
  } catch (e) {
    console.log('Error reading:', e.message);
  }
});
