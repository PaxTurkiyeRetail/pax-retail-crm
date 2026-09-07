const fs = require('fs');

function norm(s) {
  return s
    .replace(/\(in-house\)/gi, '')
    .replace(/\(([^)]*)\)/g, ' $1 ')
    .toLocaleLowerCase('tr-TR')
    .replace(/[^a-z0-9çğıöşü]/g, '')
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
const newSet = new Set(newNames);
const oldLines = lines.filter(l => !newSet.has(l));

for (const nn of newNames) {
  const nnorm = norm(nn);
  for (const ol of oldLines) {
    const onorm = norm(ol);
    if (onorm.length < 3) continue;
    if (nnorm === onorm) continue; // exact caught elsewhere
    if (nnorm.includes(onorm) || onorm.includes(nnorm)) {
      // avoid trivial short-substring noise: require overlap >= 4 chars
      const shorter = onorm.length < nnorm.length ? onorm : nnorm;
      if (shorter.length >= 4) {
        console.log(`OLASI: "${nn}"  <->  "${ol}"`);
      }
    }
  }
}
