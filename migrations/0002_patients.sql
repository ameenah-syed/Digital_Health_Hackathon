CREATE TABLE IF NOT EXISTS patients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  initials TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT 'Asthma care'
);

INSERT OR IGNORE INTO patients (id, name, initials, summary) VALUES
  ('PT-2048', 'Jordan M.', 'JM', 'Asthma care · Active monitoring'),
  ('PT-3107', 'Sam R.', 'SR', 'Asthma care · Active monitoring'),
  ('PT-4821', 'Casey T.', 'CT', 'Asthma care · Active monitoring'),
  ('PT-5639', 'Avery L.', 'AL', 'Asthma care · Active monitoring');

ALTER TABLE checkins ADD COLUMN patient_id TEXT NOT NULL DEFAULT 'PT-2048';
CREATE INDEX IF NOT EXISTS checkins_patient_created ON checkins(patient_id, created_at DESC);

-- Synthetic profiles with distinct sample trends for the multi-patient demo.
INSERT INTO checkins (id, created_at, feeling, inhaler_needed, medication_taken, inhaler_reasons, timing, symptoms, peak_flow, patient_id)
VALUES
  (11, strftime('%Y-%m-%dT09:15:00.000Z', 'now'), 5, 0, 1, '[]', 'No pattern', '[]', 460, 'PT-3107'),
  (12, strftime('%Y-%m-%dT09:15:00.000Z', 'now', '-1 days'), 4, 1, 1, '["Exercise"]', 'After activity', '["Coughing"]', 430, 'PT-3107'),
  (13, strftime('%Y-%m-%dT09:15:00.000Z', 'now', '-3 days'), 4, 0, 1, '[]', 'Morning', '[]', 445, 'PT-3107'),
  (14, strftime('%Y-%m-%dT09:15:00.000Z', 'now', '-5 days'), 3, 1, 1, '["Pollen / allergies"]', 'Evening', '["Coughing"]', 410, 'PT-3107'),
  (15, strftime('%Y-%m-%dT09:15:00.000Z', 'now', '-8 days'), 5, 0, 1, '[]', 'No pattern', '[]', 455, 'PT-3107'),
  (16, strftime('%Y-%m-%dT09:15:00.000Z', 'now', '-12 days'), 4, 0, 1, '[]', 'Morning', '[]', 440, 'PT-3107'),
  (17, strftime('%Y-%m-%dT09:15:00.000Z', 'now'), 2, 1, 0, '["Cold air"]', 'At night', '["Wheezing","Tight chest"]', 335, 'PT-4821'),
  (18, strftime('%Y-%m-%dT09:15:00.000Z', 'now', '-2 days'), 3, 1, 1, '["Illness"]', 'Morning', '["Coughing"]', 360, 'PT-4821'),
  (19, strftime('%Y-%m-%dT09:15:00.000Z', 'now', '-4 days'), 3, 0, 1, '[]', 'No pattern', '[]', 375, 'PT-4821'),
  (20, strftime('%Y-%m-%dT09:15:00.000Z', 'now', '-6 days'), 2, 1, 1, '["Cold air"]', 'At night', '["Wheezing","Tight chest"]', 345, 'PT-4821'),
  (21, strftime('%Y-%m-%dT09:15:00.000Z', 'now', '-9 days'), 4, 0, 1, '[]', 'Evening', '[]', 390, 'PT-4821'),
  (22, strftime('%Y-%m-%dT09:15:00.000Z', 'now', '-13 days'), 3, 1, 0, '["Exercise"]', 'During activity', '["Coughing"]', 350, 'PT-4821'),
  (23, strftime('%Y-%m-%dT09:15:00.000Z', 'now'), 4, 0, 1, '[]', 'No pattern', '[]', 425, 'PT-5639'),
  (24, strftime('%Y-%m-%dT09:15:00.000Z', 'now', '-1 days'), 5, 0, 1, '[]', 'Morning', '[]', 440, 'PT-5639'),
  (25, strftime('%Y-%m-%dT09:15:00.000Z', 'now', '-4 days'), 4, 1, 1, '["Exercise"]', 'During activity', '["Coughing"]', 405, 'PT-5639'),
  (26, strftime('%Y-%m-%dT09:15:00.000Z', 'now', '-7 days'), 5, 0, 1, '[]', 'No pattern', '[]', 450, 'PT-5639'),
  (27, strftime('%Y-%m-%dT09:15:00.000Z', 'now', '-10 days'), 4, 0, 1, '[]', 'Evening', '[]', 435, 'PT-5639'),
  (28, strftime('%Y-%m-%dT09:15:00.000Z', 'now', '-14 days'), 5, 0, 1, '[]', 'No pattern', '[]', 445, 'PT-5639');
