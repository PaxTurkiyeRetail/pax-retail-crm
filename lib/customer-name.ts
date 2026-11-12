export function customerNameKey(name: string): string {
  return name.normalize('NFC')
    .replace(/[iıİşŞğĞüÜöÖçÇ]/g, (letter) => ({ i: 'I', ı: 'I', İ: 'I', ş: 's', Ş: 'S', ğ: 'g', Ğ: 'G', ü: 'u', Ü: 'U', ö: 'o', Ö: 'O', ç: 'c', Ç: 'C' })[letter]!)
    .replace(/[a-z]/g, (letter) => letter.toUpperCase())
    .replace(/[^A-Z0-9]/g, '');
}
