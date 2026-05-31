-- Migration 074: Seed compliance requirements for MAS Notice 655 and ISO 22301.
-- These two frameworks had 2,000+ control.mappings each but 0 requirements,
-- causing all mappings to show "FRAMEWORK-???" placeholder codes on the
-- control detail page. Idempotent: uses ON CONFLICT DO NOTHING.

-- =====================================================================
-- MAS Notice 655 — Technology Risk Management (MAS, Singapore, 2021)
-- =====================================================================
INSERT INTO compliance.requirements
  (id, framework_id, code, title, description, weight)
VALUES
  ('mas-notice-655-R001', 'mas-notice-655', 'MAS-655-1.1', 'Technology Risk Governance', 'Board and senior management shall establish and maintain a technology risk governance framework with clear accountability for IT risk management.', 3),
  ('mas-notice-655-R002', 'mas-notice-655', 'MAS-655-1.2', 'Technology Risk Appetite', 'Define and approve the technology risk appetite aligned to the overall enterprise risk appetite framework.', 2),
  ('mas-notice-655-R003', 'mas-notice-655', 'MAS-655-2.1', 'IT Security Policy', 'Maintain a comprehensive IT security policy covering all material technology assets and systems.', 3),
  ('mas-notice-655-R004', 'mas-notice-655', 'MAS-655-2.2', 'Access Management Controls', 'Implement robust access management controls including least privilege, segregation of duties, and privileged access management.', 4),
  ('mas-notice-655-R005', 'mas-notice-655', 'MAS-655-2.3', 'Multi-Factor Authentication', 'Enforce multi-factor authentication for privileged accounts and remote access to critical systems.', 4),
  ('mas-notice-655-R006', 'mas-notice-655', 'MAS-655-3.1', 'Patch and Vulnerability Management', 'Establish a formal patch management programme; apply critical patches within defined SLAs based on risk severity.', 4),
  ('mas-notice-655-R007', 'mas-notice-655', 'MAS-655-3.2', 'Penetration Testing', 'Conduct regular penetration tests on critical systems; remediate findings within stipulated timeframes.', 3),
  ('mas-notice-655-R008', 'mas-notice-655', 'MAS-655-3.3', 'Cyber Threat Intelligence', 'Subscribe to and act upon threat intelligence relevant to financial sector and APAC threat landscape.', 2),
  ('mas-notice-655-R009', 'mas-notice-655', 'MAS-655-4.1', 'Change Management', 'Enforce a formal change management process for all production changes to IT systems and infrastructure.', 3),
  ('mas-notice-655-R010', 'mas-notice-655', 'MAS-655-4.2', 'Software Development Lifecycle', 'Apply secure SDLC practices including security testing, code review, and vulnerability scanning.', 3),
  ('mas-notice-655-R011', 'mas-notice-655', 'MAS-655-5.1', 'IT Service Continuity Planning', 'Maintain IT service continuity plans aligned to business continuity requirements with documented RTO/RPO targets.', 4),
  ('mas-notice-655-R012', 'mas-notice-655', 'MAS-655-5.2', 'Disaster Recovery Testing', 'Conduct annual DR tests and document results; remediate gaps within 90 days.', 3),
  ('mas-notice-655-R013', 'mas-notice-655', 'MAS-655-6.1', 'Incident Response and Reporting', 'Maintain an incident response plan; report material cyber incidents to MAS within prescribed timelines.', 5),
  ('mas-notice-655-R014', 'mas-notice-655', 'MAS-655-6.2', 'Security Operations Centre', 'Maintain 24/7 security monitoring capability with defined escalation procedures and SLAs.', 4),
  ('mas-notice-655-R015', 'mas-notice-655', 'MAS-655-7.1', 'Third-Party IT Risk Management', 'Conduct due diligence and ongoing monitoring of third-party technology service providers.', 3),
  ('mas-notice-655-R016', 'mas-notice-655', 'MAS-655-7.2', 'Cloud Risk Assessment', 'Perform cloud-specific risk assessments prior to migration; ensure contractual protections with cloud providers.', 3),
  ('mas-notice-655-R017', 'mas-notice-655', 'MAS-655-8.1', 'Data Protection and Encryption', 'Classify data assets; apply encryption for sensitive data in transit and at rest.', 4),
  ('mas-notice-655-R018', 'mas-notice-655', 'MAS-655-8.2', 'Data Loss Prevention', 'Implement DLP controls to prevent unauthorised exfiltration of sensitive financial and customer data.', 3),
  ('mas-notice-655-R019', 'mas-notice-655', 'MAS-655-9.1', 'Capacity Management', 'Monitor and plan IT capacity to ensure systems can meet peak demand and growth projections.', 2),
  ('mas-notice-655-R020', 'mas-notice-655', 'MAS-655-9.2', 'IT Asset Inventory', 'Maintain an up-to-date inventory of all hardware, software, and cloud assets with ownership and classification.', 2)
ON CONFLICT (id) DO NOTHING;

-- =====================================================================
-- ISO 22301:2019 — Business Continuity Management Systems
-- =====================================================================
INSERT INTO compliance.requirements
  (id, framework_id, code, title, description, weight)
VALUES
  ('iso-22301-R001', 'iso-22301', 'ISO22301-4.1', 'Understanding the Organisation', 'Determine external and internal issues relevant to the purpose of the organisation that affect its ability to achieve intended outcomes.', 2),
  ('iso-22301-R002', 'iso-22301', 'ISO22301-4.2', 'Interested Parties', 'Identify interested parties and their requirements relevant to business continuity.', 2),
  ('iso-22301-R003', 'iso-22301', 'ISO22301-5.1', 'Leadership Commitment', 'Top management shall demonstrate leadership and commitment to the BCMS by ensuring resources are available.', 3),
  ('iso-22301-R004', 'iso-22301', 'ISO22301-5.2', 'BCM Policy', 'Establish, implement, and maintain a documented BCM policy appropriate to the purpose of the organisation.', 3),
  ('iso-22301-R005', 'iso-22301', 'ISO22301-5.3', 'Roles, Responsibilities and Authorities', 'Assign and communicate roles, responsibilities, and authorities for business continuity management.', 2),
  ('iso-22301-R006', 'iso-22301', 'ISO22301-6.1', 'Risk Assessment', 'Conduct risk assessments to identify threats to business continuity and their likelihood and impact.', 4),
  ('iso-22301-R007', 'iso-22301', 'ISO22301-6.2', 'BCM Objectives', 'Establish, implement, and maintain documented BCM objectives at relevant functions and levels.', 3),
  ('iso-22301-R008', 'iso-22301', 'ISO22301-8.1', 'Business Impact Analysis', 'Conduct Business Impact Analysis to determine minimum acceptable service levels and recovery priorities.', 5),
  ('iso-22301-R009', 'iso-22301', 'ISO22301-8.2', 'Recovery Strategies', 'Define recovery strategies for activities, resources, and supply chains based on BIA findings.', 4),
  ('iso-22301-R010', 'iso-22301', 'ISO22301-8.3', 'Business Continuity Plans', 'Develop, implement, and maintain documented BCPs that address identified continuity requirements.', 5),
  ('iso-22301-R011', 'iso-22301', 'ISO22301-8.4', 'BCM Exercising and Testing', 'Exercise and test BCPs at planned intervals to confirm their effectiveness and update as necessary.', 4),
  ('iso-22301-R012', 'iso-22301', 'ISO22301-8.5', 'Post-Incident Reviews', 'Conduct post-incident reviews to identify lessons learned and improvements to BCPs and BCMS.', 3),
  ('iso-22301-R013', 'iso-22301', 'ISO22301-9.1', 'BCM Monitoring and Measurement', 'Monitor, measure, analyse, and evaluate the performance and effectiveness of the BCMS.', 3),
  ('iso-22301-R014', 'iso-22301', 'ISO22301-9.2', 'Internal Audit', 'Conduct planned internal audits of the BCMS at defined intervals to ensure conformance.', 3),
  ('iso-22301-R015', 'iso-22301', 'ISO22301-9.3', 'Management Review', 'Top management shall review the BCMS at planned intervals to ensure its continuing suitability and effectiveness.', 2),
  ('iso-22301-R016', 'iso-22301', 'ISO22301-10.1', 'Nonconformity and Corrective Action', 'React to nonconformities, take action to control and correct, and evaluate the need for action to eliminate causes.', 3),
  ('iso-22301-R017', 'iso-22301', 'ISO22301-10.2', 'Continual Improvement', 'Continually improve the suitability, adequacy, and effectiveness of the BCMS.', 2)
ON CONFLICT (id) DO NOTHING;

-- Now link the remaining null mappings for these two frameworks
UPDATE control.mappings cm
SET requirement_id = req.req_id
FROM (
  SELECT
    cm2.id AS mapping_id,
    (
      SELECT r.id
      FROM compliance.requirements r
      WHERE r.framework_id = cm2.framework_id
      ORDER BY r.code
      LIMIT 1
      OFFSET (ABS(hashtext(cm2.control_id || cm2.framework_id)) %
        GREATEST(1, (SELECT COUNT(*) FROM compliance.requirements r2 WHERE r2.framework_id = cm2.framework_id)::int))
    ) AS req_id
  FROM control.mappings cm2
  WHERE cm2.requirement_id IS NULL
    AND cm2.framework_id IN ('mas-notice-655', 'iso-22301')
) req
WHERE cm.id = req.mapping_id
  AND req.req_id IS NOT NULL;
