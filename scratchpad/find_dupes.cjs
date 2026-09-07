const fs = require('fs');

function normalizeLoose(s) {
  return s
    .replace(/\(in-house\)/gi, '')
    .replace(/\([^)]*\)/g, '')
    .toLocaleLowerCase('tr-TR')
    .replace(/[^a-z0-9çğıöşü]/g, '') // strip ALL spaces/punct for loose compare
    .trim();
}

const lines = fs.readFileSync(process.argv[2], 'utf8').split('\n').map(l => l.trim()).filter(Boolean);

const newNames = [
'POS AŞ (Toshiba)','NTTData','Menulux','ESKİ','EvsePOS','Ditravo','Serim Yazılım','Phoenix',
'Assist Yazılım (Nebim Bayi)','Oxivo','Siber Teknoloji','Tepe Bİlişim','RPS Otomasyon','Platforta',
'Neftgen','BinBin Scooter (in-house)','Diana Travel','Otomat360 (Serpet Otomasyon)','Pomsan',
'Bilecik Bel. (in-house)','Kaner Group (in-house)','TaksidePOS','MLPCare','Vascomm','Aktive Otomat',
'Integra Sistem (7A Bilişim)','Pem Enerji','Ata Üni.','Wat Mobilite (Koç)','Kalyon','Birikim Bilgisayar',
'Rotawatt','Velmor','Suffatech','Obinova','Electroop','Fling Photo Studio','Beltaş','Anttech','TDV',
'TechoPark','Microsoft Dynamics','Mergen Yazılım','Missha Kozmetik','Faturamatik','Fastsell Yazılım',
'312 POS Yazılım'
];

const byLoose = new Map();
for (const l of lines) {
  const n = normalizeLoose(l);
  if (!byLoose.has(n)) byLoose.set(n, []);
  byLoose.get(n).push(l);
}

console.log('=== Yeni eklenen 47 firma icinde DB genelinde loose-match cakisan (muhtemel duplicate) ===');
for (const name of newNames) {
  const n = normalizeLoose(name);
  const group = byLoose.get(n) || [];
  if (group.length > 1) {
    console.log(`ÇAKIŞMA: "${name}" ile eşleşenler: ${group.join(' | ')}`);
  }
}
