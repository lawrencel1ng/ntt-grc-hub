ALTER TABLE risk.appetite_statements
  ADD CONSTRAINT appetite_statements_tenant_category_unique UNIQUE (tenant_id, category);
