-- Migration 044: Fix risk.scenarios — strip tenant/number suffixes from names
-- and replace auto-seeded descriptions with scenario-specific FAIR context.
-- Idempotent: name strip is regex-guarded; description WHERE matches original.

-- =============================================================================
-- Part 1: Strip (t_tenant #N) suffixes from scenario names
-- =============================================================================

UPDATE risk.scenarios
SET name = trim(regexp_replace(name, '\s*\(t_\S+\s+#\d+\)\s*$', ''))
WHERE name ~ '\(t_\S+\s+#\d+\)\s*$';

-- =============================================================================
-- Part 2: Scenario-specific FAIR descriptions (matched post-strip)
-- =============================================================================

UPDATE risk.scenarios
SET description = CASE name
  WHEN 'Ransomware on core banking'
    THEN 'FAIR scenario: Ransomware encrypts core banking platform (CBS). TEF driven by organised cybercrime targeting Singapore FIs. Loss components: operational disruption (6–48h downtime), regulatory notification to MAS within 1h per Notice 655, customer remediation, ransom negotiation costs. Primary threat actor: financially motivated eCrime group. Key controls: immutable offsite backups, EDR, network segmentation.'
  WHEN 'PII breach via misconfigured S3'
    THEN 'FAIR scenario: Misconfigured cloud object storage exposes customer PII to public access. TEF driven by automated scanning bots and opportunistic threat actors. Loss components: PDPA regulatory fine (up to 10% annual turnover), credit monitoring for affected customers, reputational damage, legal costs. Key controls: S3 Block Public Access policy, CSPM tooling, data classification.'
  WHEN 'Insider trading misuse'
    THEN 'FAIR scenario: Privileged employee abuses access to material non-public information (MNPI) for personal trading gain. TEF low but impact high due to regulatory sanctions. Loss components: MAS enforcement action, SFC/SGX referral, civil litigation, reputational loss. Primary threat actor: disgruntled or financially motivated insider. Key controls: MNPI access controls, trade surveillance, user behaviour analytics.'
  WHEN 'Payments outage > 4h'
    THEN 'FAIR scenario: Sustained payments processing outage exceeding 4 hours triggers MAS incident reporting and SLA penalties. TEF driven by infrastructure failures, software defects, or DDoS. Loss components: transaction revenue loss, regulatory fine, customer compensation, SLA penalties. Key controls: active-passive HA architecture, circuit breakers, real-time payment monitoring.'
  WHEN 'Vendor SaaS supplier failure'
    THEN 'FAIR scenario: Tier-1 SaaS vendor experiences extended outage or insolvency, disrupting critical business processes. TEF driven by vendor concentration risk and cloud provider dependency. Loss components: business disruption, emergency procurement, data migration, regulatory notification. Key controls: vendor risk tiering, contractual exit rights, multi-vendor strategy.'
  WHEN 'Cross-border transfer breach'
    THEN 'FAIR scenario: Unauthorised cross-border data transfer violates PDPA Part IX or MAS outsourcing requirements. TEF driven by configuration errors or shadow IT. Loss components: PDPC regulatory action, customer notification costs, data recall expenses, reputational damage. Key controls: DLP tooling, cross-border transfer register, vendor DPA agreements.'
  WHEN 'AI credit scoring bias claim'
    THEN 'FAIR scenario: AI credit scoring model produces systematically biased outcomes for a protected demographic, triggering regulatory investigation. TEF driven by model drift and lack of fairness monitoring. Loss components: MAS/PDPC investigation costs, remediation for affected customers, model recall and retraining, litigation. Key controls: quarterly fairness audits, SHAP monitoring, human-in-the-loop for marginal decisions.'
  WHEN 'Cloud region outage'
    THEN 'FAIR scenario: AWS ap-southeast-1 or Azure Southeast Asia availability zone outage exceeds RTO, impacting hosted banking workloads. TEF driven by infrastructure dependency concentration. Loss components: revenue loss, SLA penalties, regulatory breach (MAS TRM Chapter 5), customer remediation. Key controls: multi-region active-passive architecture, regular DR failover tests.'
  WHEN 'AML rule failure'
    THEN 'FAIR scenario: AML transaction monitoring system fails to detect a structured financial crime campaign, resulting in regulatory enforcement. TEF driven by rule decay as criminals adapt patterns. Loss components: MAS/STRO enforcement fine, remediation programme costs, enhanced supervision, reputational damage. Key controls: regular rule tuning, transaction monitoring backtesting, STR quality audits.'
  WHEN 'Subject access request mass event'
    THEN 'FAIR scenario: Coordinated mass subject access request (SAR) campaign overwhelms DSAR handling capacity, causing PDPA SLA breaches. TEF driven by data rights advocacy groups or competitive actors. Loss components: PDPC investigation, manual processing costs, legal fees. Key controls: automated DSAR workflow, DPO oversight, 30-day SLA tracking.'
  WHEN 'CI/CD pipeline compromise'
    THEN 'FAIR scenario: Software supply chain attack injects malicious code into CI/CD pipeline, compromising production deployments. TEF driven by nation-state and sophisticated eCrime actors targeting fintech supply chains. Loss components: incident response, code audit, customer notification, regulatory breach. Key controls: SLSA compliance, signed builds, pipeline access controls, SAST/DAST.'
  WHEN 'Datacentre loss'
    THEN 'FAIR scenario: Physical datacentre loss (fire, flood, or power failure) triggers full DR activation for on-premises systems. TEF driven by climate physical risk and infrastructure failure. Loss components: hardware replacement, DR site activation costs, business disruption, regulatory notification. Key controls: geographic redundancy, annual full DR test, BCM plan review.'
  WHEN 'Insider data exfiltration'
    THEN 'FAIR scenario: Malicious insider exfiltrates sensitive customer or proprietary data to an external party. TEF driven by financially motivated employees or hostile nation-state recruitment. Loss components: PDPA regulatory fine, customer remediation, legal action, reputational loss. Key controls: DLP, privileged access monitoring, UEBA, offboarding access revocation SLA.'
  WHEN 'Wire fraud via BEC'
    THEN 'FAIR scenario: Business email compromise (BEC) social-engineering attack results in fraudulent wire transfer authorisation. TEF driven by organised eCrime groups targeting FI treasury and finance functions. Loss components: direct financial loss (often unrecoverable), investigation costs, internal controls review. Key controls: dual-authorisation for transfers, callback verification, staff awareness training.'
  WHEN 'Phishing-led credential theft'
    THEN 'FAIR scenario: Large-scale spear-phishing campaign harvests privileged credentials, enabling lateral movement within the banking environment. TEF driven by opportunistic eCrime and advanced persistent threats. Loss components: incident response, customer notification, regulatory reporting, reputational loss. Key controls: MFA enforcement, phishing-resistant authentication, security awareness training.'
  WHEN 'OSS supply chain compromise'
    THEN 'FAIR scenario: Malicious open-source package in the npm/PyPI dependency tree introduces backdoor into production systems. TEF driven by increasingly common OSS poisoning campaigns. Loss components: emergency code audit, incident response, customer notification, regulatory disclosure. Key controls: SCA tooling (SBOM), dependency pinning, SLSA attestation.'
  WHEN 'Quantum-decrypt of long-lived secrets'
    THEN 'FAIR scenario: Harvest-now-decrypt-later attack captures encrypted data today for future decryption once quantum computers achieve cryptographic relevance (est. 2030–2035). TEF driven by nation-state adversaries targeting regulated FI data. Loss components: retroactive disclosure obligations, regulatory sanction, reputational damage. Key controls: post-quantum cryptography migration roadmap, crypto-agility assessment.'
  WHEN 'DDoS on consumer portal'
    THEN 'FAIR scenario: Sustained volumetric DDoS attack takes the consumer banking portal offline for >2 hours, triggering MAS incident reporting obligations. TEF driven by hacktivism or extortion campaigns. Loss components: revenue loss during outage, regulatory notification, SLA penalties, reputational damage. Key controls: DDoS scrubbing service, rate limiting, CDN edge protection.'
  WHEN 'API abuse (credential stuffing)'
    THEN 'FAIR scenario: High-volume credential stuffing attack against the open banking API results in account takeovers for a subset of customers. TEF driven by leaked credential lists from third-party breaches. Loss components: customer remediation, liability for unauthorised transactions, regulatory notification, reputational loss. Key controls: MFA enforcement, API rate limiting, anomaly detection, CAPTCHA.'
  WHEN 'Regulatory fine — MAS Notice 655'
    THEN 'FAIR scenario: Material non-compliance with MAS Notice 655 (TPRM or incident reporting obligations) triggers MAS enforcement action. TEF driven by growing regulatory scrutiny of cloud outsourcing and third-party concentrations. Loss components: MAS fine and directions, remediation programme, enhanced supervision costs, reputational damage. Key controls: TPRM programme, outsourcing register, incident reporting SLA.'
  WHEN 'HERO — Cross-border outsourcing failure (MAS 655 trigger)'
    THEN 'FAIR scenario aligned to MAS Notice 655 update. Loss = regulatory fine + remediation + reputational. Triggered by failure of a cross-border outsourced function exceeding MAS materiality threshold. Primary threat: regulatory enforcement, operational disruption. Controls: outsourcing register, concentration risk limits, exit plan testing.'
  ELSE description
END
WHERE description = 'FAIR scenario auto-seeded. Frequency and magnitude calibrated to industry benchmarks.';
