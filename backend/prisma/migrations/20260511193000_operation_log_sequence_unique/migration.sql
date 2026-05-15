-- Ensure reconnect sync has a single deterministic operation order per project.
DROP INDEX IF EXISTS "operation_logs_project_id_client_seq_idx";
CREATE UNIQUE INDEX "operation_logs_project_id_client_seq_key" ON "operation_logs"("project_id", "client_seq");
