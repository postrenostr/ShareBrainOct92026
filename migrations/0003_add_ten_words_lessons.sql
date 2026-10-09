CREATE TABLE IF NOT EXISTS ten_words_lessons (
  language varchar(10) NOT NULL,
  lesson_number integer NOT NULL CHECK (lesson_number BETWEEN 1 AND 50),
  words json NOT NULL CHECK (json_typeof(words) = 'array' AND json_array_length(words) = 10),
  sentences json NOT NULL CHECK (json_typeof(sentences) = 'array' AND json_array_length(sentences) = 10),
  audio_base64 text,
  created_at timestamp NOT NULL DEFAULT now(),
  PRIMARY KEY (language, lesson_number)
);
