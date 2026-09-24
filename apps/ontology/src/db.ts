import { Kysely, PostgresDialect, type Generated } from "kysely";
import { Pool } from "pg";

type Json = unknown;

export interface ObjectTypeTable {
  id: Generated<string>;
  api_name: string;
  name: string;
  description: string | null;
  status: string;
  visibility: string;
  point_of_contact: string | null;
  edits_enabled: boolean;
  schema: string;
  datasource_table: string;
}

interface PropertyTable {
  id: Generated<string>;
  api_name: string;
  name: string;
  object_type_id: string;
  data_type: string;
  required: boolean;
  is_title: boolean;
  is_primary_key: boolean;
  datasource_column: string;
}

interface LinkTable {
  id: Generated<string>;
  api_name: string;
  name: string;
  inverse_api_name: string;
  inverse_name: string;
  source_type_id: string;
  target_type_id: string;
  via_property_id: string;
  cardinality: string;
}

export interface ActionTypeTable {
  id: Generated<string>;
  api_name: string;
  name: string;
  object_type_id: string;
  description: string | null;
  parameter_schema: Json;
}

interface AuditLogTable {
  id: Generated<string>;
  action_type_id: string;
  action_api_name: string;
  target_type_id: string;
  target_type_api_name: string;
  target_id: string;
  actor: string;
  params: Json;
  result: Json;
  created_at: Date;
}

export interface TankTable {
  id: string;
  name: string;
  capacity: string;
  status: string;
  current_temperature: string | null;
  commissioned_at: Date;
}

interface LineTable {
  id: string;
  name: string;
  status: string;
  commissioned_at: Date;
}

export interface BatchTable {
  id: string;
  recipe_id: string;
  target_volume: string;
  status: string;
  planned_start: Date;
  current_sugar_level: string | null;
  current_temperature: string | null;
  days_fermenting: number;
  assigned_tank_id: string | null;
  assigned_operator_id: string | null;
  last_operator_note: string | null;
}

interface BottlingRunTable {
  id: string;
  batch_id: string;
  line_id: string;
  planned_start: Date;
  status: string;
  assigned_operator_id: string | null;
}

interface MaintenanceLogTable {
  id: string;
  target_type: string;
  target_id: string;
  type: string;
  status: string;
  planned_at: Date | null;
  started_at: Date | null;
  completed_at: Date | null;
  notes: string | null;
}

interface OperatorTable {
  id: string;
  name: string;
  certifications: string[];
  shift: string;
}

interface RecipeTable {
  id: string;
  name: string;
  target_sugar_curve: Json;
  fermentation_days: number;
  required_ingredients: string[];
  notes: string | null;
}

interface QualityTestTable {
  id: string;
  batch_id: string;
  test_date: Date;
  ph: string;
  sugar_level: string;
  notes: string | null;
  tested_by: string;
}

export interface Database {
  object_type: ObjectTypeTable;
  property: PropertyTable;
  link: LinkTable;
  action_type: ActionTypeTable;
  audit_log: AuditLogTable;
  "manufacturing.tank": TankTable;
  "manufacturing.line": LineTable;
  "manufacturing.batch": BatchTable;
  "manufacturing.bottling_run": BottlingRunTable;
  "manufacturing.maintenance_log": MaintenanceLogTable;
  "manufacturing.operator": OperatorTable;
  "manufacturing.recipe": RecipeTable;
  "manufacturing.quality_test": QualityTestTable;
}

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

export const db = new Kysely<Database>({
  dialect: new PostgresDialect({
    pool: new Pool({ connectionString: databaseUrl }),
  }),
});
