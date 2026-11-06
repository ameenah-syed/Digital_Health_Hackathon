CREATE TABLE IF NOT EXISTS checkins (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  feeling INTEGER NOT NULL CHECK (feeling BETWEEN 1 AND 5),
  inhaler_needed INTEGER NOT NULL CHECK (inhaler_needed IN (0, 1)),
  medication_taken INTEGER NOT NULL DEFAULT 1 CHECK (medication_taken IN (0, 1)),
  inhaler_reasons TEXT NOT NULL DEFAULT '[]',
  timing TEXT NOT NULL DEFAULT '',
  symptoms TEXT NOT NULL DEFAULT '[]',
  peak_flow INTEGER
);

CREATE INDEX IF NOT EXISTS checkins_created_at ON checkins(created_at DESC);

-- Clearly synthetic sample check-ins used by the judge demo.
INSERT INTO checkins (id, created_at, feeling, inhaler_needed, medication_taken, inhaler_reasons, timing, symptoms, peak_flow)
VALUES
  ('demo-01', strftime('%Y-%m-%dT09:15:00.000Z', 'now', '-14 days'), 3, 1, 1, '["Exercise"]', 'During activity', '["Coughing","Tight chest"]', 390),
  ('demo-02', strftime('%Y-%m-%dT09:15:00.000Z', 'now', '-11 days'), 4, 0, 1, '[]', 'Morning', '[]', 420),
  ('demo-03', strftime('%Y-%m-%dT09:15:00.000Z', 'now', '-9 days'), 2, 1, 0, '["Cold air"]', 'At night', '["Wheezing"]', 350),
  ('demo-04', strftime('%Y-%m-%dT09:15:00.000Z', 'now', '-7 days'), 5, 0, 1, '[]', 'No pattern', '[]', 440),
  ('demo-05', strftime('%Y-%m-%dT09:15:00.000Z', 'now', '-5 days'), 3, 1, 1, '["Exercise","Pollen / allergies"]', 'During activity', '["Shortness of breath"]', 380),
  ('demo-06', strftime('%Y-%m-%dT09:15:00.000Z', 'now', '-4 days'), 4, 0, 1, '[]', 'Evening', '["Coughing"]', 410),
  ('demo-07', strftime('%Y-%m-%dT09:15:00.000Z', 'now', '-2 days'), 1, 1, 0, '["Cold air"]', 'At night', '["Wheezing","Tight chest"]', 320),
  ('demo-08', strftime('%Y-%m-%dT09:15:00.000Z', 'now', '-1 days'), 5, 0, 1, '[]', 'No pattern', '[]', 450),
  ('demo-09', strftime('%Y-%m-%dT09:15:00.000Z', 'now', '-1 days', '+6 hours'), 4, 0, 1, '[]', 'Morning', '[]', 430),
  ('demo-10', strftime('%Y-%m-%dT09:15:00.000Z', 'now'), 3, 1, 1, '["Exercise"]', 'During activity', '["Coughing"]', 395);
