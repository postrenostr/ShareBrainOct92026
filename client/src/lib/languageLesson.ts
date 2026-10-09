/** Parse the explicit tutor format without assuming a Latin writing system. */
export function parseStructuredLanguageLesson(content: string) {
  const lines = content.split(/\r?\n/);
  const vocabularyStart = lines.findIndex(line => /^Vocabulary:\s*$/i.test(line.trim()));
  const sentencesStart = lines.findIndex(line => /^Sentences:\s*$/i.test(line.trim()));
  if (vocabularyStart < 0 || sentencesStart <= vocabularyStart) return null;
  const parsePairs = (source: string[]) => source.flatMap(line => {
    const match = line.trim().match(/^(.+?)\s+[—–-]\s+(.+)$/u);
    return match ? [{ target: match[1].trim(), english: match[2].trim() }] : [];
  });
  const words = parsePairs(lines.slice(vocabularyStart + 1, sentencesStart));
  const remaining = lines.slice(sentencesStart + 1);
  const notesStart = remaining.findIndex(line => /^Notes:\s*$/i.test(line.trim()));
  const sentences = parsePairs(notesStart < 0 ? remaining : remaining.slice(0, notesStart));
  if (words.length !== 10 || sentences.length !== 10) return null;
  return {
    hasLesson: true,
    translationText: [
      "Vocabulary:", ...words.map(pair => `${pair.target} — ${pair.english}`),
      "", "Sentences:", ...sentences.map(pair => `${pair.target} — ${pair.english}`),
    ].join("\n"),
    targetText: [...words.map(pair => pair.target), "", ...sentences.map(pair => pair.target)].join("\n"),
  };
}
