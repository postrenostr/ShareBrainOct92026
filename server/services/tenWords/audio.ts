// Identify saved MP3s; WAV recordings from the former pause pipeline are
// replaced on next playback using the original single-request narration.
export function isMp3Audio(audio: Buffer): boolean {
  return audio.length >= 3 && (audio.toString("ascii", 0, 3) === "ID3" ||
    (audio[0] === 0xff && (audio[1] & 0xe0) === 0xe0));
}
