-- Migration 092: Add the six DEMO_LOGINS users to platform.users so they work
-- in pg mode. Two of them (admin@ntt.sg, agent-ops@ntt.sg) need the '__all__'
-- platform-admin tenant which acts as an MSSP roll-up sentinel throughout the app.
-- Password hash is for 'Demo1234!' — same as all other seed users.

-- Platform-admin sentinel tenant (not a real customer tenant)
INSERT INTO platform.tenants (id, name, industry, region, classified, sla_tier, headquartered_in, mrr_sgd)
VALUES ('__all__', 'NTT Singapore (Platform)', 'Technology', 'SG', false, 'enterprise', 'Singapore', 0)
ON CONFLICT (id) DO NOTHING;

-- Demo login users — idempotent via ON CONFLICT DO NOTHING
INSERT INTO platform.users (email, name, role, tenant_id, status, password_hash)
VALUES
  ('admin@ntt.sg',      'Lawrence Tan',  'admin',          '__all__',   'active', '$2b$12$Fb64vSkfoWRFMC.oRHh1wOxcNNSIxl7wVr2wBpHu7IsgCzY.crt1y'),
  ('ciso@maybank.sg',   'Aisha Rahman',  'risk-owner',     't_maybank', 'active', '$2b$12$Fb64vSkfoWRFMC.oRHh1wOxcNNSIxl7wVr2wBpHu7IsgCzY.crt1y'),
  ('auditor@mindef.sg', 'Col. R. Kumar', 'auditor',        't_mindef',  'active', '$2b$12$Fb64vSkfoWRFMC.oRHh1wOxcNNSIxl7wVr2wBpHu7IsgCzY.crt1y'),
  ('control@grab.com',  'Wei Ming Lee',  'control-owner',  't_grab',    'active', '$2b$12$Fb64vSkfoWRFMC.oRHh1wOxcNNSIxl7wVr2wBpHu7IsgCzY.crt1y'),
  ('agent-ops@ntt.sg',  'Priya Nair',    'agent-operator', '__all__',   'active', '$2b$12$Fb64vSkfoWRFMC.oRHh1wOxcNNSIxl7wVr2wBpHu7IsgCzY.crt1y'),
  ('viewer@maybank.sg', 'Jason Chua',    'viewer',         't_maybank', 'active', '$2b$12$Fb64vSkfoWRFMC.oRHh1wOxcNNSIxl7wVr2wBpHu7IsgCzY.crt1y')
ON CONFLICT (email) DO NOTHING;

\echo ' >> demo login users added (admin@ntt.sg, ciso@maybank.sg, auditor@mindef.sg, control@grab.com, agent-ops@ntt.sg, viewer@maybank.sg)'
