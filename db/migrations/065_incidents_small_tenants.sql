-- Migration 065: Add incidents and postmortems for 5 small tenants.
-- Large tenants (Grab, Maybank, MINDEF) already have data.
-- Idempotent: INSERT WHERE NOT EXISTS on (tenant_id, code).

-- =====================================================================
-- Part 1: Incidents (3 per small tenant, mix of severities/statuses)
-- =====================================================================
WITH new_incidents AS (
  INSERT INTO incident.incidents
    (tenant_id, code, severity, title, status, opened_at, contained_at, resolved_at, tags, created_at)
  SELECT v.tenant_id, v.code,
         v.sev::incident.severity,
         v.title,
         v.status::incident.status,
         now() - make_interval(days => v.opened_days_ago),
         CASE WHEN v.status IN ('contained','resolved','postmortem-done')
           THEN now() - make_interval(days => v.opened_days_ago - 1) ELSE NULL END,
         CASE WHEN v.status IN ('resolved','postmortem-done')
           THEN now() - make_interval(days => v.opened_days_ago - 3) ELSE NULL END,
         v.tags::jsonb,
         now() - make_interval(days => v.opened_days_ago + 1)
  FROM (VALUES
    -- A*STAR (Research)
    ('t_astar','ASTAR-INC-001','sev3','HPC cluster storage degradation during genome sequencing batch',
     'postmortem-done',45,'["infrastructure","storage","hpc"]'),
    ('t_astar','ASTAR-INC-002','sev2','Unauthorized API access to research dataset repository',
     'resolved',30,'["security","access-control","data"]'),
    ('t_astar','ASTAR-INC-003','sev4','Scheduled maintenance window overrun — 2h downtime on NRF portal',
     'postmortem-done',90,'["maintenance","availability"]'),

    -- GovTech (Public Sector)
    ('t_govtech','GTSG-INC-001','sev2','Askgov chatbot returning incorrect CPF scheme eligibility answers',
     'postmortem-done',60,'["ai","citizen-services","data-quality"]'),
    ('t_govtech','GTSG-INC-002','sev3','GovCloud connectivity degradation affecting 3 agency APIs',
     'resolved',40,'["infrastructure","availability","api"]'),
    ('t_govtech','GTSG-INC-003','sev4','Phishing campaign targeting MyInfo users identified by ISAC',
     'postmortem-done',20,'["security","phishing","identity"]'),

    -- Mediacorp (Media)
    ('t_mediacorp','MEDI-INC-001','sev3','meWATCH CDN failover latency spike during National Day live stream',
     'postmortem-done',55,'["cdn","streaming","availability"]'),
    ('t_mediacorp','MEDI-INC-002','sev4','Content recommendation engine serving stale model predictions',
     'resolved',35,'["ai","recommendations","data-freshness"]'),
    ('t_mediacorp','MEDI-INC-003','sev3','DRM license server intermittent failures affecting premium subscribers',
     'postmortem-done',80,'["drm","content-protection","availability"]'),

    -- SingHealth (Healthcare)
    ('t_singhealth','SHIN-INC-001','sev2','EPIC EMR scheduled downtime exceeded SLA — 4h outage in SGH cluster',
     'postmortem-done',50,'["emr","availability","clinical"]'),
    ('t_singhealth','SHIN-INC-002','sev3','Clinical deterioration predictor alert queue backlog during peak load',
     'resolved',25,'["ai","clinical","performance"]'),
    ('t_singhealth','SHIN-INC-003','sev4','Ransomware attempt blocked by SingHealth SOC — no data exfiltration',
     'postmortem-done',70,'["security","ransomware","soc"]'),

    -- Singtel (Telecommunications)
    ('t_singtel','STEL-INC-001','sev2','Core network BGP route flap causing 12-minute outage in central region',
     'postmortem-done',42,'["network","bgp","availability"]'),
    ('t_singtel','STEL-INC-002','sev3','NOC anomaly detector false-positive storm — 2,400 spurious alerts',
     'resolved',28,'["ai","monitoring","false-positive"]'),
    ('t_singtel','STEL-INC-003','sev4','Billing system batch job failure — delayed invoices for enterprise segment',
     'postmortem-done',65,'["billing","batch","data"]')
  ) AS v(tenant_id, code, sev, title, status, opened_days_ago, tags)
  WHERE NOT EXISTS (
    SELECT 1 FROM incident.incidents i WHERE i.tenant_id = v.tenant_id AND i.code = v.code
  )
  RETURNING id, tenant_id, code
)
-- Part 1b: Postmortems for postmortem-done incidents
INSERT INTO incident.postmortems
  (tenant_id, incident_id, root_cause_md, corrective_actions_md, signed_off_at, created_at)
SELECT ni.tenant_id, ni.id,
  CASE ni.code
    WHEN 'ASTAR-INC-001' THEN
      '## Root Cause\nA failing RAID controller on the primary storage node caused sequential I/O degradation. The condition went undetected for 6 hours before alerting threshold was breached.'
    WHEN 'ASTAR-INC-003' THEN
      '## Root Cause\nDatabase schema migration on the NRF portal ran longer than estimated due to an unindexed foreign key on the grants table (4.2M rows). No rollback plan was tested pre-maintenance.'
    WHEN 'GTSG-INC-001' THEN
      '## Root Cause\nA CPF scheme policy update (effective 1 Apr) was not reflected in the knowledge base used for RAG retrieval. The LLM confidently answered from stale context for 3 days before detection.'
    WHEN 'GTSG-INC-003' THEN
      '## Root Cause\nThreat actor spoofed a gov.sg subdomain using a recently-expired TLS certificate. DMARC enforcement was missing on the subdomain. ISAC threat intel shared the IoCs 4h after campaign launch.'
    WHEN 'MEDI-INC-001' THEN
      '## Root Cause\nPrimary CDN PoP in Singapore experienced a provider-side network partition. Automated failover to the backup PoP triggered but took 8 minutes due to TTL on DNS records not being lowered pre-event.'
    WHEN 'MEDI-INC-003' THEN
      '## Root Cause\nDRM license server certificate renewal automation failed silently due to a missing notification on the renewal job. Certificate expired at 03:17 SGT and was not detected until support tickets arrived at 06:45.'
    WHEN 'SHIN-INC-001' THEN
      '## Root Cause\nSGH EPIC cluster patch required a filesystem check on the SAN volume, which took 3.2h on a 48TB volume — 4× the estimated duration. Patch was not tested on a representative volume size in UAT.'
    WHEN 'SHIN-INC-003' THEN
      '## Root Cause\nAttacker gained initial access via a compromised vendor VPN credential. Lateral movement was detected by the EDR within 22 minutes. SOC isolation procedures contained the host before any data was accessed.'
    WHEN 'STEL-INC-001' THEN
      '## Root Cause\nA BGP peer configuration change applied to a transit router introduced a route loop affecting 3 upstream peers. The change was made manually without a pre-change peer review or automated syntax validation.'
    WHEN 'STEL-INC-003' THEN
      '## Root Cause\nBilling batch job failed due to a deadlock on the invoice staging table caused by a concurrent schema migration that was not coordinated with the batch scheduler. The job had no dead-letter retry logic.'
    ELSE '## Root Cause\nInvestigation completed. Root cause identified and documented.'
  END,
  CASE ni.code
    WHEN 'ASTAR-INC-001' THEN
      '- Replace RAID controller and expand monitoring to include I/O latency on all storage nodes\n- Add predictive disk health checks via S.M.A.R.T. to alerting pipeline\n- Document storage failure runbook'
    WHEN 'ASTAR-INC-003' THEN
      '- Require all DB migrations on tables >1M rows to be tested on production-scale replica\n- Add maintenance window rollback plans to change management checklist\n- Set hard timeout on migration scripts (2× estimated duration)'
    WHEN 'GTSG-INC-001' THEN
      '- Implement automated CPF/MOF policy change detection via regwatch agent\n- Add knowledge base staleness checks to Askgov quality pipeline\n- Weekly review of top 20 incorrect answers with editorial team'
    WHEN 'GTSG-INC-003' THEN
      '- Enforce DMARC on all gov.sg subdomains including inactive ones\n- Automate TLS certificate expiry monitoring for all 300+ subdomains\n- Reduce ISAC IoC ingestion pipeline from 4h to <30min'
    WHEN 'MEDI-INC-001' THEN
      '- Lower TTL on CDN failover DNS records from 300s to 30s for live-stream domains\n- Schedule quarterly CDN failover tests to validate recovery time\n- Add CDN PoP health to NOC dashboard'
    WHEN 'MEDI-INC-003' THEN
      '- Implement certificate expiry monitoring with alerts at 30/14/7/1 day thresholds\n- Add redundant DRM license servers in active-active configuration\n- Require certificate renewal tests in staging 14 days before production renewal'
    WHEN 'SHIN-INC-001' THEN
      '## Corrective Actions\n- Test all EPIC patches on representative-size volumes in UAT before SGH production\n- Add SAN filesystem check duration estimates to maintenance runbooks\n- Implement patient-facing status page for planned maintenance'
    WHEN 'SHIN-INC-003' THEN
      '- Rotate all vendor VPN credentials and enforce MFA for all third-party access\n- Reduce EDR alert-to-isolation SLA from 30min to 15min\n- Implement privileged access workstation requirement for vendor connections'
    WHEN 'STEL-INC-001' THEN
      '- Mandate peer review and automated syntax validation for all BGP config changes\n- Implement change freeze on transit routers during peak hours (08:00-22:00)\n- Add BGP route loop detection to NOC alerting'
    WHEN 'STEL-INC-003' THEN
      '- Coordinate all schema migrations with the batch scheduler via change calendar\n- Add dead-letter queue and retry logic to billing batch job\n- Implement cross-team change advisory review for billing-adjacent migrations'
    ELSE '- Corrective actions identified and assigned to owners.'
  END,
  now() - make_interval(days => 3),
  now() - make_interval(days => 5)
FROM new_incidents ni
WHERE ni.code NOT IN ('ASTAR-INC-002','GTSG-INC-002','MEDI-INC-002','SHIN-INC-002','STEL-INC-002');
