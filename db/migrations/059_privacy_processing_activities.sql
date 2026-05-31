-- Migration 059: Add privacy processing activities (ROPA) for 5 small tenants.
-- Only Grab, Maybank, MINDEF have processing activities. Adding 3-4 per
-- small tenant representing realistic data processing scenarios per org type.
-- Idempotent: unique constraint on (tenant_id, code).

INSERT INTO privacy.processing_activities
  (tenant_id, code, name, controller, processor, purpose, lawful_basis,
   data_categories, retention_period, cross_border, jurisdictions)
VALUES
  -- A*STAR (Research)
  ('t_astar','ASTAR-ROPA-001','Research Participant Data Management','t_astar',NULL,
   'Collect and process data from human research participants for approved NRF/MOE-funded studies',
   'consent', ARRAY['name','email','medical','biometric'],'10 years',false,ARRAY['SG']),
  ('t_astar','ASTAR-ROPA-002','HR Employee Records','t_astar',NULL,
   'Manage employment records, payroll, benefits and performance reviews for all staff',
   'legal-obligation',ARRAY['name','email','phone','financial','employment'],'7 years',false,ARRAY['SG']),
  ('t_astar','ASTAR-ROPA-003','Grant Applicant Processing','t_astar',NULL,
   'Process grant applications, disburse research funding and report to government agencies',
   'legal-obligation',ARRAY['name','email','financial'],'7 years',false,ARRAY['SG']),
  ('t_astar','ASTAR-ROPA-004','Research Collaboration Data Sharing','t_astar',NULL,
   'Share pseudonymised research data with international academic partners under data sharing agreements',
   'contract',ARRAY['name','email','biometric'],'5 years',true,ARRAY['SG','US','UK','AU']),

  -- GovTech (Public Sector)
  ('t_govtech','GTSG-ROPA-001','Singpass Identity Verification','t_govtech',NULL,
   'Authenticate Singapore residents and citizens for access to government digital services',
   'legal-obligation',ARRAY['name','national-id','biometric'],'5 years',false,ARRAY['SG']),
  ('t_govtech','GTSG-ROPA-002','MyInfo Data Aggregation','t_govtech',NULL,
   'Aggregate and serve verified personal data to authorised government and private sector services',
   'legal-obligation',ARRAY['name','national-id','email','phone','employment','financial'],'3 years',false,ARRAY['SG']),
  ('t_govtech','GTSG-ROPA-003','Developer Portal User Accounts','t_govtech',NULL,
   'Manage developer accounts for SHIP-HATS CI/CD platform and API portal access',
   'contract',ARRAY['name','email','employment'],'3 years',false,ARRAY['SG']),
  ('t_govtech','GTSG-ROPA-004','Procurement and Vendor Management','t_govtech',NULL,
   'Process vendor tender applications, contracts and payment transactions for GovTech procurement',
   'legal-obligation',ARRAY['name','email','financial','employment'],'7 years',false,ARRAY['SG']),

  -- Mediacorp (Media)
  ('t_mediacorp','MEDI-ROPA-001','meWATCH Subscriber Profiles','t_mediacorp',NULL,
   'Manage viewer accounts, streaming preferences, and viewing history for meWATCH platform',
   'contract',ARRAY['name','email','phone','behavioural'],'2 years',false,ARRAY['SG']),
  ('t_mediacorp','MEDI-ROPA-002','Advertising Audience Targeting','t_mediacorp',NULL,
   'Process aggregated demographic and behavioural data to enable targeted digital advertising',
   'consent',ARRAY['name','email','behavioural'],'1 year',false,ARRAY['SG']),
  ('t_mediacorp','MEDI-ROPA-003','Talent and Artiste Contracts','t_mediacorp',NULL,
   'Manage employment and service contracts for on-air talent, journalists and production staff',
   'contract',ARRAY['name','email','phone','financial','medical'],'7 years',false,ARRAY['SG']),
  ('t_mediacorp','MEDI-ROPA-004','Press Reader Subscription Data','t_mediacorp',NULL,
   'Process subscriber data for digital news products including The Straits Times digital editions',
   'contract',ARRAY['name','email','phone','financial'],'3 years',false,ARRAY['SG','MY']),

  -- SingHealth (Healthcare)
  ('t_singhealth','SHIN-ROPA-001','Electronic Medical Records','t_singhealth',NULL,
   'Collect, store and process patient medical records for clinical care across SingHealth cluster',
   'vital-interests',ARRAY['name','national-id','medical','biometric'],'15 years',false,ARRAY['SG']),
  ('t_singhealth','SHIN-ROPA-002','Patient Contact Tracing','t_singhealth',NULL,
   'Process patient contact information for infectious disease reporting to MOH under Infectious Diseases Act',
   'legal-obligation',ARRAY['name','national-id','phone','address','medical'],'5 years',false,ARRAY['SG']),
  ('t_singhealth','SHIN-ROPA-003','Clinical Research Registry','t_singhealth',NULL,
   'Maintain research participant registry for SingHealth IRB-approved clinical trials and studies',
   'consent',ARRAY['name','national-id','email','medical','biometric'],'20 years',false,ARRAY['SG']),
  ('t_singhealth','SHIN-ROPA-004','Staff Rostering and Payroll','t_singhealth',NULL,
   'Manage staff scheduling, attendance and payroll processing for all SingHealth employees',
   'contract',ARRAY['name','email','phone','financial','employment'],'7 years',false,ARRAY['SG']),

  -- Singtel (Telecommunications)
  ('t_singtel','STEL-ROPA-001','Customer Subscriber Management','t_singtel',NULL,
   'Manage consumer and enterprise subscriber accounts, billing and service provisioning',
   'contract',ARRAY['name','national-id','email','phone','address','financial'],'5 years',false,ARRAY['SG']),
  ('t_singtel','STEL-ROPA-002','Network Traffic and QoS Monitoring','t_singtel',NULL,
   'Monitor network traffic patterns and quality of service metrics under Telecommunications Act',
   'legal-obligation',ARRAY['behavioural'],'90 days',false,ARRAY['SG']),
  ('t_singtel','STEL-ROPA-003','Cybersecurity Managed Services Client Data','t_singtel',NULL,
   'Process endpoint and network telemetry data for enterprise managed detection and response services',
   'contract',ARRAY['name','email','behavioural'],'1 year',false,ARRAY['SG','AU','IN','ID','PH','TH']),
  ('t_singtel','STEL-ROPA-004','Marketing and Loyalty Programme','t_singtel',NULL,
   'Operate Yes! Rewards loyalty programme and process opt-in marketing communications',
   'consent',ARRAY['name','email','phone','address','financial','behavioural'],'2 years',false,ARRAY['SG'])
ON CONFLICT (tenant_id, code) DO NOTHING;
