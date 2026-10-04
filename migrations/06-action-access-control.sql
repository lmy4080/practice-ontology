ALTER TABLE manufacturing.action_type
  ADD COLUMN IF NOT EXISTS allowed_callers TEXT[];

CREATE TABLE IF NOT EXISTS manufacturing.access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caller_identity TEXT NOT NULL,
  action_type TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('allowed', 'denied')),
  reason TEXT NOT NULL,
  "timestamp" TIMESTAMPTZ NOT NULL DEFAULT now()
);

UPDATE manufacturing.action_type
SET allowed_callers = ARRAY['brewmaster-lee', 'verification-agent']::TEXT[]
WHERE api_name = 'approve'
  AND object_type_id = (
    SELECT id FROM manufacturing.object_type WHERE api_name = 'proposal'
  );
