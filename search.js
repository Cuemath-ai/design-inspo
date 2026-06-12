export function entryHaystack(e) {
  const tagWords = Object.values(e.tags ?? {}).flat();
  const noteWords = (e.notes ?? []).map(n => n.note);
  return [e.title, e.description, ...noteWords, ...tagWords]
    .join(' ').toLowerCase();
}

export function expandQuery(query, synonyms) {
  const terms = new Set(query.toLowerCase().split(/[\s,]+/).filter(Boolean));
  for (const t of [...terms]) {
    if (synonyms[t]) synonyms[t].forEach(s => terms.add(s));
    for (const [key, vals] of Object.entries(synonyms))
      if (vals.includes(t)) { terms.add(key); vals.forEach(s => terms.add(s)); }
  }
  return [...terms];
}

export function scoreEntry(entry, terms) {
  const hay = entryHaystack(entry);
  let score = 0;
  for (const t of terms) if (hay.includes(t)) score += 1;
  return score;
}
