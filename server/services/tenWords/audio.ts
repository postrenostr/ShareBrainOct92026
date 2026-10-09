// OpenAI PCM output: signed 16-bit little-endian, mono, 24 kHz.
export const SAMPLE_RATE = 24000;
export const WORD_PAUSE_MS = 600;
export const SECTION_PAUSE_MS = 1000;

export function pcmWave(pcm: Buffer): Buffer {
  if (!pcm.length || pcm.length % 2) throw new Error("Invalid PCM audio");
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVEfmt ", 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // linear PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(SAMPLE_RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

export function isPausedLessonAudio(audio: Buffer): boolean {
  return audio.length > 44 && audio.toString("ascii", 0, 4) === "RIFF" &&
    audio.toString("ascii", 8, 16) === "WAVEfmt " && audio.toString("ascii", 36, 40) === "data" &&
    audio.readUInt32LE(40) === audio.length - 44;
}

export function joinLessonAudio(words: Buffer[], sentences: Buffer): Buffer {
  if (words.length !== 10 || [...words, sentences].some(pcm => !pcm.length || pcm.length % 2)) {
    throw new Error("Incomplete lesson audio");
  }
  const wordPause = Buffer.alloc(SAMPLE_RATE * 2 * WORD_PAUSE_MS / 1000);
  const sectionPause = Buffer.alloc(SAMPLE_RATE * 2 * SECTION_PAUSE_MS / 1000);
  const segments: Buffer[] = [];
  words.forEach((word, index) => {
    segments.push(word, index === words.length - 1 ? sectionPause : wordPause);
  });
  segments.push(sentences);
  return pcmWave(Buffer.concat(segments));
}
