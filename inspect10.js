const XLSX = require('xlsx');

const file = 'mayor_analitico.xls';
const wb = XLSX.readFile(file);
const ws = wb.Sheets[wb.SheetNames[0]];
const rawData = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false });

for (let i = 0; i < rawData.length; i++) {
    const col0 = String(rawData[i][0] || '').trim();
    if (col0 === 'Estructura Programatica') {
        const ep = String(rawData[i + 1]?.[0] || '').trim();
        const acc = String(rawData[i + 2]?.[0] || '').trim();
        const ejec = String(rawData[i + 3]?.[0] || '').trim();
        console.log('EP:', ep);
        console.log('Acc:', acc);
        console.log('Ejec:', ejec);
        console.log('---');
    }
}
