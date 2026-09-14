BEGIN;

CREATE SCHEMA IF NOT EXISTS manufacturing;

CREATE TABLE IF NOT EXISTS manufacturing.tank (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  capacity NUMERIC NOT NULL,
  status TEXT NOT NULL,
  current_temperature NUMERIC,
  commissioned_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS manufacturing.line (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL,
  commissioned_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS manufacturing.operator (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  certifications TEXT[] NOT NULL,
  shift TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS manufacturing.recipe (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  target_sugar_curve JSONB NOT NULL,
  fermentation_days INTEGER NOT NULL,
  required_ingredients TEXT[] NOT NULL,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS manufacturing.batch (
  id TEXT PRIMARY KEY,
  recipe_id TEXT NOT NULL REFERENCES manufacturing.recipe(id),
  target_volume NUMERIC NOT NULL,
  status TEXT NOT NULL,
  planned_start TIMESTAMPTZ NOT NULL,
  current_sugar_level NUMERIC,
  current_temperature NUMERIC,
  days_fermenting INTEGER NOT NULL,
  assigned_tank_id TEXT REFERENCES manufacturing.tank(id),
  assigned_operator_id TEXT REFERENCES manufacturing.operator(id),
  last_operator_note TEXT
);

CREATE TABLE IF NOT EXISTS manufacturing.bottling_run (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL REFERENCES manufacturing.batch(id),
  line_id TEXT NOT NULL REFERENCES manufacturing.line(id),
  planned_start TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL,
  assigned_operator_id TEXT REFERENCES manufacturing.operator(id)
);

CREATE TABLE IF NOT EXISTS manufacturing.maintenance_log (
  id TEXT PRIMARY KEY,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS manufacturing.quality_test (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL REFERENCES manufacturing.batch(id),
  test_date TIMESTAMPTZ NOT NULL,
  ph NUMERIC NOT NULL,
  sugar_level NUMERIC NOT NULL,
  notes TEXT,
  tested_by TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS manufacturing.object_type (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_name TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL,
  visibility TEXT NOT NULL,
  point_of_contact TEXT,
  edits_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  schema TEXT NOT NULL,
  datasource_table TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS manufacturing.property (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_name TEXT NOT NULL,
  name TEXT NOT NULL,
  object_type_id UUID NOT NULL REFERENCES manufacturing.object_type(id),
  data_type TEXT NOT NULL,
  required BOOLEAN NOT NULL DEFAULT FALSE,
  is_title BOOLEAN NOT NULL DEFAULT FALSE,
  is_primary_key BOOLEAN NOT NULL DEFAULT FALSE,
  datasource_column TEXT NOT NULL,
  UNIQUE (object_type_id, api_name)
);

CREATE TABLE IF NOT EXISTS manufacturing.link (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_name TEXT NOT NULL,
  name TEXT NOT NULL,
  inverse_api_name TEXT NOT NULL,
  inverse_name TEXT NOT NULL,
  source_type_id UUID NOT NULL REFERENCES manufacturing.object_type(id),
  target_type_id UUID NOT NULL REFERENCES manufacturing.object_type(id),
  via_property_id UUID NOT NULL REFERENCES manufacturing.property(id),
  cardinality TEXT NOT NULL,
  UNIQUE (source_type_id, api_name)
);

CREATE TABLE IF NOT EXISTS manufacturing.action_type (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_name TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  object_type_id UUID NOT NULL REFERENCES manufacturing.object_type(id),
  description TEXT,
  parameter_schema JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS manufacturing.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type_id UUID NOT NULL REFERENCES manufacturing.action_type(id),
  action_api_name TEXT NOT NULL,
  target_type_id UUID NOT NULL REFERENCES manufacturing.object_type(id),
  target_type_api_name TEXT NOT NULL,
  target_id TEXT NOT NULL,
  actor TEXT NOT NULL,
  params JSONB NOT NULL,
  result JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO manufacturing.object_type (
  api_name,
  name,
  description,
  status,
  visibility,
  point_of_contact,
  edits_enabled,
  schema,
  datasource_table
)
VALUES
  ('Tank', 'Tank', 'Fermentation and storage tank', 'active', 'public', 'Manufacturing Operations', TRUE, 'manufacturing', 'tank'),
  ('Line', 'Line', 'Bottling production line', 'active', 'public', 'Manufacturing Operations', TRUE, 'manufacturing', 'line'),
  ('Batch', 'Batch', 'Manufacturing batch', 'active', 'public', 'Manufacturing Operations', TRUE, 'manufacturing', 'batch'),
  ('BottlingRun', 'Bottling Run', 'Scheduled bottling run', 'active', 'public', 'Manufacturing Operations', TRUE, 'manufacturing', 'bottling_run'),
  ('MaintenanceLog', 'Maintenance Log', 'Maintenance work record', 'active', 'public', 'Manufacturing Operations', TRUE, 'manufacturing', 'maintenance_log'),
  ('Operator', 'Operator', 'Manufacturing operator', 'active', 'public', 'Manufacturing Operations', TRUE, 'manufacturing', 'operator'),
  ('Recipe', 'Recipe', 'Production recipe', 'active', 'public', 'Manufacturing Operations', TRUE, 'manufacturing', 'recipe'),
  ('QualityTest', 'Quality Test', 'Batch quality test result', 'active', 'public', 'Quality Assurance', TRUE, 'manufacturing', 'quality_test')
ON CONFLICT (api_name) DO NOTHING;

WITH property_seed (
  object_type_api_name,
  api_name,
  name,
  data_type,
  required,
  is_title,
  is_primary_key,
  datasource_column
) AS (
  VALUES
    ('Tank', 'id', 'ID', 'string', TRUE, FALSE, TRUE, 'id'),
    ('Tank', 'name', 'Name', 'string', TRUE, TRUE, FALSE, 'name'),
    ('Tank', 'capacity', 'Capacity', 'number', TRUE, FALSE, FALSE, 'capacity'),
    ('Tank', 'status', 'Status', 'string', TRUE, FALSE, FALSE, 'status'),
    ('Tank', 'currentTemperature', 'Current Temperature', 'number', FALSE, FALSE, FALSE, 'current_temperature'),
    ('Tank', 'commissionedAt', 'Commissioned At', 'datetime', TRUE, FALSE, FALSE, 'commissioned_at'),

    ('Line', 'id', 'ID', 'string', TRUE, FALSE, TRUE, 'id'),
    ('Line', 'name', 'Name', 'string', TRUE, TRUE, FALSE, 'name'),
    ('Line', 'status', 'Status', 'string', TRUE, FALSE, FALSE, 'status'),
    ('Line', 'commissionedAt', 'Commissioned At', 'datetime', TRUE, FALSE, FALSE, 'commissioned_at'),

    ('Batch', 'id', 'ID', 'string', TRUE, TRUE, TRUE, 'id'),
    ('Batch', 'recipeId', 'Recipe ID', 'string', TRUE, FALSE, FALSE, 'recipe_id'),
    ('Batch', 'targetVolume', 'Target Volume', 'number', TRUE, FALSE, FALSE, 'target_volume'),
    ('Batch', 'status', 'Status', 'string', TRUE, FALSE, FALSE, 'status'),
    ('Batch', 'plannedStart', 'Planned Start', 'datetime', TRUE, FALSE, FALSE, 'planned_start'),
    ('Batch', 'currentSugarLevel', 'Current Sugar Level', 'number', FALSE, FALSE, FALSE, 'current_sugar_level'),
    ('Batch', 'currentTemperature', 'Current Temperature', 'number', FALSE, FALSE, FALSE, 'current_temperature'),
    ('Batch', 'daysFermenting', 'Days Fermenting', 'integer', TRUE, FALSE, FALSE, 'days_fermenting'),
    ('Batch', 'assignedTankId', 'Assigned Tank ID', 'string', FALSE, FALSE, FALSE, 'assigned_tank_id'),
    ('Batch', 'assignedOperatorId', 'Assigned Operator ID', 'string', FALSE, FALSE, FALSE, 'assigned_operator_id'),
    ('Batch', 'lastOperatorNote', 'Last Operator Note', 'string', FALSE, FALSE, FALSE, 'last_operator_note'),

    ('BottlingRun', 'id', 'ID', 'string', TRUE, TRUE, TRUE, 'id'),
    ('BottlingRun', 'batchId', 'Batch ID', 'string', TRUE, FALSE, FALSE, 'batch_id'),
    ('BottlingRun', 'lineId', 'Line ID', 'string', TRUE, FALSE, FALSE, 'line_id'),
    ('BottlingRun', 'plannedStart', 'Planned Start', 'datetime', TRUE, FALSE, FALSE, 'planned_start'),
    ('BottlingRun', 'status', 'Status', 'string', TRUE, FALSE, FALSE, 'status'),
    ('BottlingRun', 'assignedOperatorId', 'Assigned Operator ID', 'string', FALSE, FALSE, FALSE, 'assigned_operator_id'),

    ('MaintenanceLog', 'id', 'ID', 'string', TRUE, TRUE, TRUE, 'id'),
    ('MaintenanceLog', 'targetType', 'Target Type', 'string', TRUE, FALSE, FALSE, 'target_type'),
    ('MaintenanceLog', 'targetId', 'Target ID', 'string', TRUE, FALSE, FALSE, 'target_id'),
    ('MaintenanceLog', 'type', 'Type', 'string', TRUE, FALSE, FALSE, 'type'),
    ('MaintenanceLog', 'status', 'Status', 'string', TRUE, FALSE, FALSE, 'status'),
    ('MaintenanceLog', 'startedAt', 'Started At', 'datetime', TRUE, FALSE, FALSE, 'started_at'),
    ('MaintenanceLog', 'completedAt', 'Completed At', 'datetime', FALSE, FALSE, FALSE, 'completed_at'),
    ('MaintenanceLog', 'notes', 'Notes', 'string', FALSE, FALSE, FALSE, 'notes'),

    ('Operator', 'id', 'ID', 'string', TRUE, FALSE, TRUE, 'id'),
    ('Operator', 'name', 'Name', 'string', TRUE, TRUE, FALSE, 'name'),
    ('Operator', 'certifications', 'Certifications', 'string[]', TRUE, FALSE, FALSE, 'certifications'),
    ('Operator', 'shift', 'Shift', 'string', TRUE, FALSE, FALSE, 'shift'),

    ('Recipe', 'id', 'ID', 'string', TRUE, FALSE, TRUE, 'id'),
    ('Recipe', 'name', 'Name', 'string', TRUE, TRUE, FALSE, 'name'),
    ('Recipe', 'targetSugarCurve', 'Target Sugar Curve', 'json', TRUE, FALSE, FALSE, 'target_sugar_curve'),
    ('Recipe', 'fermentationDays', 'Fermentation Days', 'integer', TRUE, FALSE, FALSE, 'fermentation_days'),
    ('Recipe', 'requiredIngredients', 'Required Ingredients', 'string[]', TRUE, FALSE, FALSE, 'required_ingredients'),
    ('Recipe', 'notes', 'Notes', 'string', FALSE, FALSE, FALSE, 'notes'),

    ('QualityTest', 'id', 'ID', 'string', TRUE, TRUE, TRUE, 'id'),
    ('QualityTest', 'batchId', 'Batch ID', 'string', TRUE, FALSE, FALSE, 'batch_id'),
    ('QualityTest', 'testDate', 'Test Date', 'datetime', TRUE, FALSE, FALSE, 'test_date'),
    ('QualityTest', 'ph', 'pH', 'number', TRUE, FALSE, FALSE, 'ph'),
    ('QualityTest', 'sugarLevel', 'Sugar Level', 'number', TRUE, FALSE, FALSE, 'sugar_level'),
    ('QualityTest', 'notes', 'Notes', 'string', FALSE, FALSE, FALSE, 'notes'),
    ('QualityTest', 'testedBy', 'Tested By', 'string', TRUE, FALSE, FALSE, 'tested_by')
)
INSERT INTO manufacturing.property (
  object_type_id,
  api_name,
  name,
  data_type,
  required,
  is_title,
  is_primary_key,
  datasource_column
)
SELECT
  object_type.id,
  property_seed.api_name,
  property_seed.name,
  property_seed.data_type,
  property_seed.required,
  property_seed.is_title,
  property_seed.is_primary_key,
  property_seed.datasource_column
FROM property_seed
JOIN manufacturing.object_type
  ON object_type.api_name = property_seed.object_type_api_name
ON CONFLICT (object_type_id, api_name) DO NOTHING;

WITH link_seed (
  source_api_name,
  target_api_name,
  via_property_api_name,
  api_name,
  name,
  inverse_api_name,
  inverse_name,
  cardinality
) AS (
  VALUES
    ('Batch', 'Tank', 'assignedTankId', 'assignedTank', 'Assigned Tank', 'assignedBatches', 'Assigned Batches', 'many_to_one'),
    ('Batch', 'Operator', 'assignedOperatorId', 'assignedOperator', 'Assigned Operator', 'assignedBatches', 'Assigned Batches', 'many_to_one'),
    ('Batch', 'Recipe', 'recipeId', 'recipe', 'Recipe', 'batches', 'Batches', 'many_to_one'),
    ('BottlingRun', 'Batch', 'batchId', 'batch', 'Batch', 'bottlingRuns', 'Bottling Runs', 'many_to_one'),
    ('BottlingRun', 'Line', 'lineId', 'line', 'Line', 'bottlingRuns', 'Bottling Runs', 'many_to_one'),
    ('QualityTest', 'Batch', 'batchId', 'batch', 'Batch', 'qualityTests', 'Quality Tests', 'many_to_one')
)
INSERT INTO manufacturing.link (
  api_name,
  name,
  inverse_api_name,
  inverse_name,
  source_type_id,
  target_type_id,
  via_property_id,
  cardinality
)
SELECT
  link_seed.api_name,
  link_seed.name,
  link_seed.inverse_api_name,
  link_seed.inverse_name,
  source_type.id,
  target_type.id,
  via_property.id,
  link_seed.cardinality
FROM link_seed
JOIN manufacturing.object_type AS source_type
  ON source_type.api_name = link_seed.source_api_name
JOIN manufacturing.object_type AS target_type
  ON target_type.api_name = link_seed.target_api_name
JOIN manufacturing.property AS via_property
  ON via_property.object_type_id = source_type.id
 AND via_property.api_name = link_seed.via_property_api_name
ON CONFLICT (source_type_id, api_name) DO NOTHING;

INSERT INTO manufacturing.action_type (
  api_name,
  name,
  object_type_id,
  description,
  parameter_schema
)
SELECT
  'Batch.deferStart',
  'Defer Start',
  object_type.id,
  'Postpone the batch''s planned start date',
  '{
    "type": "object",
    "properties": {
      "newPlannedStart": {
        "type": "string",
        "format": "date-time"
      }
    },
    "required": ["newPlannedStart"],
    "additionalProperties": false
  }'::jsonb
FROM manufacturing.object_type
WHERE object_type.api_name = 'Batch'
ON CONFLICT (api_name) DO NOTHING;

INSERT INTO manufacturing.tank (
  id,
  name,
  capacity,
  status,
  current_temperature,
  commissioned_at
)
VALUES ('T-12', 'Fermentation Tank 12', 12000, 'in_use', 12.5, '2021-04-15T00:00:00Z')
ON CONFLICT (id) DO NOTHING;

INSERT INTO manufacturing.recipe (
  id,
  name,
  target_sugar_curve,
  fermentation_days,
  required_ingredients,
  notes
)
VALUES (
  'REC-LAGER-V3',
  'Lager V3',
  '[
    {"day": 0, "sugarLevel": 12.0},
    {"day": 3, "sugarLevel": 7.5},
    {"day": 7, "sugarLevel": 3.0},
    {"day": 14, "sugarLevel": 1.5}
  ]'::jsonb,
  14,
  ARRAY['lager malt', 'hops', 'yeast', 'water'],
  'Cold-fermented house lager recipe'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO manufacturing.operator (id, name, certifications, shift)
VALUES ('OP-PARK-KW', 'Park Kyungwon', ARRAY['fermentation', 'tank-safety'], 'day')
ON CONFLICT (id) DO NOTHING;

INSERT INTO manufacturing.batch (
  id,
  recipe_id,
  target_volume,
  status,
  planned_start,
  current_sugar_level,
  current_temperature,
  days_fermenting,
  assigned_tank_id,
  assigned_operator_id,
  last_operator_note
)
VALUES (
  'B-2105',
  'REC-LAGER-V3',
  10000,
  'fermenting',
  '2026-09-03T09:00:00+09:00',
  3.2,
  12.5,
  7,
  'T-12',
  'OP-PARK-KW',
  'Fermentation is tracking the target curve.'
)
ON CONFLICT (id) DO NOTHING;

COMMIT;
