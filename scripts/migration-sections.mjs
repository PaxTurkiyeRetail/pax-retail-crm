// The original baseline remains byte-for-byte intact. New SQL lives in named,
// append-only sections of the same file; each section retains its own checksum.
export function migrationSections(filename, sql) {
  const markers = [...sql.matchAll(/^-- CRM_APPEND_MIGRATION: (\d+_[a-z0-9_]+\.sql)\r?\n/gim)];
  if (!markers.length) return [{ version: filename, sql }];
  const sections = [{ version: filename, sql: sql.slice(0, markers[0].index) }];
  for (let i = 0; i < markers.length; i++) {
    sections.push({ version: markers[i][1], sql: sql.slice(markers[i].index + markers[i][0].length, markers[i + 1]?.index ?? sql.length) });
  }
  if (new Set(sections.map(s => s.version)).size !== sections.length) throw new Error('Duplicate migration section.');
  if (sections.some(s => !s.sql.trim())) throw new Error('Empty migration section.');
  return sections;
}
