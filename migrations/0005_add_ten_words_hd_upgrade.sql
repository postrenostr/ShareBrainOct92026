-- Development only. Managed production schema is applied through Publish.
CREATE TABLE IF NOT EXISTS ten_words_hd_upgrade_jobs (
  id text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ten_words_hd_upgrade_items (
  job_id text NOT NULL REFERENCES ten_words_hd_upgrade_jobs(id),
  language varchar(10) NOT NULL,
  lesson_number integer NOT NULL,
  text_hash text NOT NULL,
  audio_hash text,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  message text,
  prepared_audio text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (job_id, language, lesson_number)
);
