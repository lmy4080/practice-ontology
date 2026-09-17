-- Additional manufacturing demo data from the larger foundation seed.
-- Apply after seeds/manufacturing.sql.

BEGIN;

INSERT INTO manufacturing.operator (id, name, certifications, shift) VALUES
  ('op-park', 'Park Kyungwon', ARRAY['Fermentation Monitoring', 'Tank Cleaning', 'Quality Sampling'], 'Day'),
  ('EMP-2847', 'Le Linh', ARRAY['Fermentation Monitoring', 'Tank Cleaning', 'Quality Sampling'], 'Night')
ON CONFLICT (id) DO NOTHING;

INSERT INTO manufacturing.recipe (id, name, target_sugar_curve, fermentation_days, required_ingredients, notes) VALUES
  ('REC-PILSNER-V2', 'Pilsner V2', '{"day_1":1.048,"day_4":1.032,"day_8":1.010,"day_14":1.000}', 14, ARRAY['Pilsner Malt','Saaz Hops','Yeast'], NULL),
  ('REC-STOUT-V1', 'Stout V1', '{"day_1":1.065,"day_5":1.040,"day_10":1.018,"day_18":1.012}', 18, ARRAY['Roasted Barley','Malt','Hops','Yeast'], NULL),
  ('REC-WHEAT-V1', 'Wheat Ale V1', '{"day_1":1.052,"day_3":1.038,"day_6":1.020,"day_10":1.008}', 10, ARRAY['Wheat Malt','Malt','Hops','Yeast'], NULL),
  ('REC-PALE-V2', 'Pale Ale V2', '{"day_1":1.055,"day_4":1.036,"day_8":1.018,"day_12":1.008}', 12, ARRAY['Pale Malt','Cascade Hops','Yeast'], NULL),
  ('REC-AMBER-V1', 'Amber Ale V1', '{"day_1":1.058,"day_4":1.038,"day_7":1.020,"day_12":1.010}', 12, ARRAY['Crystal Malt','Malt','Hops','Yeast'], NULL),
  ('REC-PORTER-V1', 'Porter V1', '{"day_1":1.060,"day_4":1.042,"day_8":1.022,"day_12":1.010,"day_16":1.005}', 16, ARRAY['Chocolate Malt','Malt','Hops','Yeast'], NULL),
  ('REC-CITRA-IPA', 'Citra IPA', '{"day_1":1.062,"day_4":1.040,"day_8":1.020,"day_12":1.010}', 12, ARRAY['Pale Malt','Citra Hops','Yeast'], NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO manufacturing.tank (id, name, capacity, status, current_temperature, commissioned_at) VALUES
  ('T-7', 'FV-7', 200, 'idle', NULL, '2019-03-20'),
  ('T-8', 'FV-8', 200, 'idle', NULL, '2019-03-20'),
  ('T-3', 'FV-1', 150, 'fermenting', 11.5, '2017-01-10'),
  ('T-5', 'FV-4', 150, 'fermenting', 12.5, '2018-02-15'),
  ('T-9', 'FV-9', 200, 'fermenting', 16.0, '2020-01-05'),
  ('T-11', 'FV-11', 200, 'fermenting', 13.0, '2020-06-15')
ON CONFLICT (id) DO NOTHING;

INSERT INTO manufacturing.line (id, name, status, commissioned_at) VALUES
  ('L-3', 'Bottling Line 3', 'idle', '2019-08-01')
ON CONFLICT (id) DO NOTHING;

INSERT INTO manufacturing.batch (id, recipe_id, target_volume, status, planned_start, current_sugar_level, current_temperature, days_fermenting, assigned_tank_id, assigned_operator_id, last_operator_note) VALUES
  ('B-2107', 'REC-PILSNER-V2', 150, 'fermenting', '2026-04-20', 1.010, 11.5, 10, 'T-3', 'op-park', NULL),
  ('B-2110', 'REC-STOUT-V1', 200, 'fermenting', '2026-04-18', 1.018, 13.0, 12, NULL, 'EMP-2847', NULL),
  ('B-2134', 'REC-WHEAT-V1', 150, 'fermenting', '2026-04-24', 1.020, 11.5, 6, 'T-3', 'op-park', NULL),
  ('B-2156', 'REC-PALE-V2', 150, 'fermenting', '2026-04-20', 1.018, 12.5, 10, 'T-5', 'EMP-2847', NULL),
  ('B-2179', 'REC-AMBER-V1', 200, 'fermenting', '2026-04-23', 1.025, 16.0, 7, 'T-9', 'op-park', 'Temperature creeping since glycol service yesterday.'),
  ('B-2203', 'REC-PORTER-V1', 200, 'fermenting', '2026-04-18', 1.035, 13.0, 12, 'T-11', 'EMP-2847', 'Sour smell noticed during routine check.'),
  ('B-2120', 'REC-LAGER-V3', 200, 'queued', '2026-05-01', NULL, NULL, 0, 'T-7', 'op-park', NULL),
  ('B-2121', 'REC-PILSNER-V2', 150, 'queued', '2026-05-01', NULL, NULL, 0, 'T-7', 'op-park', NULL),
  ('B-2122', 'REC-WHEAT-V1', 150, 'queued', '2026-05-02', NULL, NULL, 0, 'T-7', 'op-park', NULL),
  ('B-2124', 'REC-LAGER-V3', 200, 'queued', '2026-05-07', NULL, NULL, 0, 'T-12', 'op-park', NULL),
  ('B-2130', 'REC-PILSNER-V2', 150, 'queued', '2026-05-01', NULL, NULL, 0, NULL, 'op-park', NULL),
  ('B-2098', 'REC-CITRA-IPA', 200, 'fermenting', '2026-04-10', 1.010, 12.0, 20, NULL, 'EMP-2847', NULL),
  ('B-2117', 'REC-CITRA-IPA', 100, 'queued', '2026-05-05', NULL, NULL, 0, NULL, 'op-park', NULL),
  ('B-2118', 'REC-CITRA-IPA', 200, 'queued', '2026-05-06', NULL, NULL, 0, NULL, 'op-park', NULL),
  ('B-2125', 'REC-CITRA-IPA', 150, 'queued', '2026-05-01', NULL, NULL, 0, NULL, 'op-park', NULL),
  ('B-2126', 'REC-LAGER-V3', 200, 'queued', '2026-05-03', NULL, NULL, 0, NULL, 'EMP-2847', NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO manufacturing.maintenance_log (id, target_type, target_id, type, status, started_at, completed_at, notes) VALUES
  ('ML-T12-2026-04-25', 'tank', 'T-12', 'corrective', 'completed', '2026-04-25 08:00', '2026-04-25 14:00', 'Thermocouple replaced on upper sensor mount.'),
  ('ML-T9-2026-04-29', 'tank', 'T-9', 'preventive', 'completed', '2026-04-29 06:00', '2026-04-29 10:00', 'Glycol valve serviced and flow rate adjusted.'),
  ('ML-T11-2026-04-16', 'tank', 'T-11', 'cleaning', 'completed', '2026-04-16 08:00', '2026-04-16 12:00', 'Cleaning cycle completed with no anomalies.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO manufacturing.quality_test (id, batch_id, test_date, ph, sugar_level, notes, tested_by) VALUES
  ('QT-B2105-D7', 'B-2105', '2026-04-29', 4.2, 1.022, 'Slight haze, recommend retest in 24h.', 'Kim Soo-jin'),
  ('QT-B2107-D9', 'B-2107', '2026-04-29', 4.1, 1.010, 'On track, no concerns.', 'Kim Soo-jin'),
  ('QT-B2110-D11', 'B-2110', '2026-04-29', 4.0, 1.018, 'On track, no concerns.', 'Kim Soo-jin'),
  ('QT-B2134-D5', 'B-2134', '2026-04-29', 4.2, 1.020, 'On track, no concerns.', 'Kim Soo-jin'),
  ('QT-B2156-D9', 'B-2156', '2026-04-29', 4.1, 1.018, 'Sample clean, no off-flavors detected.', 'Kim Soo-jin'),
  ('QT-B2179-D6', 'B-2179', '2026-04-29', 4.3, 1.025, 'Slight sulfur on aroma, recommend monitoring.', 'Kim Soo-jin'),
  ('QT-B2203-D11', 'B-2203', '2026-04-29', 3.8, 1.035, 'Likely contamination. Recommend immediate hold.', 'Kim Soo-jin'),
  ('QT-B2098-D19', 'B-2098', '2026-04-29', 4.1, 1.010, 'On track, no concerns.', 'Kim Soo-jin')
ON CONFLICT (id) DO NOTHING;

COMMIT;
