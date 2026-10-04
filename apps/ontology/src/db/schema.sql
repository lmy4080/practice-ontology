-- Add the Brewery object and associate all existing tanks and lines with it.
-- Safe to run repeatedly after the manufacturing schema has been created.

CREATE TABLE IF NOT EXISTS manufacturing.brewery (
  id   TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

INSERT INTO manufacturing.brewery (id, name)
VALUES ('BRW-DEFAULT', 'Original Brewery')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE manufacturing.tank
  ADD COLUMN IF NOT EXISTS brewery_id TEXT;

ALTER TABLE manufacturing.line
  ADD COLUMN IF NOT EXISTS brewery_id TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'tank_brewery_id_fkey'
      AND conrelid = 'manufacturing.tank'::regclass
  ) THEN
    ALTER TABLE manufacturing.tank
      ADD CONSTRAINT tank_brewery_id_fkey
      FOREIGN KEY (brewery_id) REFERENCES manufacturing.brewery(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'line_brewery_id_fkey'
      AND conrelid = 'manufacturing.line'::regclass
  ) THEN
    ALTER TABLE manufacturing.line
      ADD CONSTRAINT line_brewery_id_fkey
      FOREIGN KEY (brewery_id) REFERENCES manufacturing.brewery(id);
  END IF;
END $$;

UPDATE manufacturing.tank
SET brewery_id = 'BRW-DEFAULT'
WHERE brewery_id IS NULL;

UPDATE manufacturing.line
SET brewery_id = 'BRW-DEFAULT'
WHERE brewery_id IS NULL;

ALTER TABLE manufacturing.tank
  ALTER COLUMN brewery_id SET NOT NULL;

ALTER TABLE manufacturing.line
  ALTER COLUMN brewery_id SET NOT NULL;

-- Ontology metadata
INSERT INTO manufacturing.object_type (
  id, api_name, name, description, schema, datasource_table
) VALUES (
  '7b8d3f20-0d3a-4a20-bc5d-2f8d7e0a1c11',
  'brewery',
  'Brewery',
  'A brewery containing production tanks and lines',
  'manufacturing',
  'brewery'
)
ON CONFLICT (api_name) DO NOTHING;

INSERT INTO manufacturing.property (
  id, object_type_id, api_name, name, data_type, required, is_title, is_primary_key, datasource_column
) VALUES
  (
    '8c9e4f31-1e4b-4b31-cd6e-3f9e8f1b2d22',
    '7b8d3f20-0d3a-4a20-bc5d-2f8d7e0a1c11',
    'id', 'ID', 'string', true, true, true, 'id'
  ),
  (
    '9d0f5042-2f5c-4c42-de7f-4a0f902c3e33',
    '7b8d3f20-0d3a-4a20-bc5d-2f8d7e0a1c11',
    'name', 'Name', 'string', true, true, false, 'name'
  )
ON CONFLICT (object_type_id, api_name) DO NOTHING;

INSERT INTO manufacturing.property (
  id, object_type_id, api_name, name, data_type, required, is_title, is_primary_key, datasource_column
)
SELECT
  'aa105153-3f6d-4d53-ef80-5b10a13d4f44',
  id,
  'breweryId',
  'Brewery',
  'string',
  true,
  false,
  false,
  'brewery_id'
FROM manufacturing.object_type
WHERE api_name = 'tank'
ON CONFLICT (object_type_id, api_name) DO NOTHING;

INSERT INTO manufacturing.property (
  id, object_type_id, api_name, name, data_type, required, is_title, is_primary_key, datasource_column
)
SELECT
    'bb216264-4a7e-4e64-af91-6c21b24e5a55',
  id,
  'breweryId',
  'Brewery',
  'string',
  true,
  false,
  false,
  'brewery_id'
FROM manufacturing.object_type
WHERE api_name = 'line'
ON CONFLICT (object_type_id, api_name) DO NOTHING;

INSERT INTO manufacturing.link (
  id, api_name, name, inverse_api_name, inverse_name,
  source_type_id, target_type_id, via_property_id, cardinality
)
SELECT
  'cc327375-5a8f-4f75-bc02-7d32c35f6a66',
  'brewery', 'Brewery', 'tanks', 'Tanks',
  tank.id,
  brewery.id,
  property.id,
  'many_to_one'
FROM manufacturing.object_type tank
JOIN manufacturing.object_type brewery ON brewery.api_name = 'brewery'
JOIN manufacturing.property property ON property.object_type_id = tank.id AND property.api_name = 'breweryId'
WHERE tank.api_name = 'tank'
ON CONFLICT DO NOTHING;

INSERT INTO manufacturing.link (
  id, api_name, name, inverse_api_name, inverse_name,
  source_type_id, target_type_id, via_property_id, cardinality
)
SELECT
  'dd438486-6a9b-4a86-bc13-8e43d46a7b77',
  'brewery', 'Brewery', 'lines', 'Lines',
  line.id,
  brewery.id,
  property.id,
  'many_to_one'
FROM manufacturing.object_type line
JOIN manufacturing.object_type brewery ON brewery.api_name = 'brewery'
JOIN manufacturing.property property ON property.object_type_id = line.id AND property.api_name = 'breweryId'
WHERE line.api_name = 'line'
ON CONFLICT DO NOTHING;
