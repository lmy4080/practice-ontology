-- Insurance claim actions and data-quality issues.

CREATE TABLE IF NOT EXISTS insurance.data_issue (
  id       TEXT PRIMARY KEY,
  claim_id TEXT NOT NULL,
  reason   TEXT NOT NULL,
  status   TEXT NOT NULL CHECK (status IN ('open', 'resolved'))
);

INSERT INTO insurance.object_type (id, api_name, name, description, schema, datasource_table) VALUES
  ('b4c3e1d2-7f69-4a43-9ef7-2d5b5d0a71c1', 'dataIssue', 'Data Issue', 'A data-quality issue recorded against a claim', 'insurance', 'data_issue')
ON CONFLICT (api_name) DO NOTHING;

INSERT INTO insurance.property (id, object_type_id, api_name, name, data_type, required, is_title, is_primary_key, datasource_column) VALUES
  ('e7a1b2c3-d4f5-4678-9012-3456789abcde', 'b4c3e1d2-7f69-4a43-9ef7-2d5b5d0a71c1', 'id',      'ID',      'string', true,  true,  true,  'id'),
  ('f8b2c3d4-e5a6-4789-0123-456789abcdef', 'b4c3e1d2-7f69-4a43-9ef7-2d5b5d0a71c1', 'claimId', 'Claim',   'string', true,  false, false, 'claim_id'),
  ('a9c3d4e5-f6b7-4890-1234-56789abcdef0', 'b4c3e1d2-7f69-4a43-9ef7-2d5b5d0a71c1', 'reason',  'Reason',  'string', true,  false, false, 'reason'),
  ('b0d4e5f6-a7c8-4901-2345-6789abcdef01', 'b4c3e1d2-7f69-4a43-9ef7-2d5b5d0a71c1', 'status',  'Status',  'enum',   true,  false, false, 'status')
ON CONFLICT (object_type_id, api_name) DO NOTHING;

INSERT INTO insurance.link (id, api_name, name, inverse_api_name, inverse_name, source_type_id, target_type_id, via_property_id, cardinality) VALUES
  ('c1e5f6a7-b8d9-4012-3456-789abcdef012', 'claim', 'Claim', 'dataIssues', 'Data Issues', 'b4c3e1d2-7f69-4a43-9ef7-2d5b5d0a71c1', '512de3ee-92cc-4e26-83b8-b3e136550aed', 'f8b2c3d4-e5a6-4789-0123-456789abcdef', 'many_to_one')
ON CONFLICT DO NOTHING;

INSERT INTO insurance.action_type (id, object_type_id, api_name, name, description, parameter_schema) VALUES
  ('d2f6a7b8-c9e0-4123-4567-89abcdef0123', '512de3ee-92cc-4e26-83b8-b3e136550aed', 'autoApprove', 'Auto Approve Claim', 'Approve a filed claim when policy, timing, documents, and cited coverage limits all validate.', '{"type":"object","properties":{"reason":{"type":"string","minLength":1},"citedClauseIds":{"type":"array","items":{"type":"string"},"minItems":1},"approvedAmount":{"type":"number","exclusiveMinimum":0}},"required":["reason","citedClauseIds","approvedAmount"],"additionalProperties":false}'),
  ('e3a7b8c9-d0f1-4234-5678-9abcdef01234', '512de3ee-92cc-4e26-83b8-b3e136550aed', 'requestMoreInfo', 'Request More Information', 'Move a filed claim to pending review while requesting additional information.', '{"type":"object","properties":{"reason":{"type":"string","minLength":1},"requestedInfo":{"type":"string","minLength":1}},"required":["reason","requestedInfo"],"additionalProperties":false}'),
  ('f4b8c9d0-e1f2-4345-6789-abcdef012345', '512de3ee-92cc-4e26-83b8-b3e136550aed', 'flagDataIssue', 'Flag Data Issue', 'Record an open data-quality issue against a claim without changing its status.', '{"type":"object","properties":{"reason":{"type":"string","minLength":1}},"required":["reason"],"additionalProperties":false}')
ON CONFLICT (object_type_id, api_name) DO NOTHING;
