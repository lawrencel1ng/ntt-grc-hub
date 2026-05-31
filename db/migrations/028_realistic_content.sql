-- Migration 028: Replace auto-seeded placeholder content with realistic text

-- =============================================================================
-- Part 1: regwatch.changes — realistic titles and summaries for 64 seeded rows
-- =============================================================================

UPDATE regwatch.changes
SET
  title = CASE title
    -- MAS (Monetary Authority of Singapore)
    WHEN 'MAS update #1' THEN 'MAS Consultation Paper on Digital Resilience Obligations 2025'
    WHEN 'MAS update #2' THEN 'MAS Notice MAS-644 Amendment — Digital Payment Token Services'
    WHEN 'MAS update #3' THEN 'MAS FSG Guidance on Climate Transition Finance Reporting'
    WHEN 'MAS update #4' THEN 'MAS Notice 655 Revision — Critical Outsourcing Risk Thresholds'
    WHEN 'MAS update #5' THEN 'MAS Cyber Hygiene Notice — Third-Party Software Inventory Controls'
    WHEN 'MAS update #6' THEN 'MAS Proposed AI Governance Framework for Financial Services'
    WHEN 'MAS update #7' THEN 'MAS Technology Risk Management Guidelines — Cryptographic Standards Update'
    WHEN 'MAS update #8' THEN 'MAS Notice MAS-626 Update — STP Continuity Requirements for Critical Systems'
    -- APRA (Australian Prudential Regulation Authority)
    WHEN 'APRA prudential update #1' THEN 'APRA CPS 230 Operational Risk Management — Final Standard Effective 1 Jul 2025'
    WHEN 'APRA prudential update #2' THEN 'APRA CPG 235 Guidance — Managing Data Risk in the Cloud'
    WHEN 'APRA prudential update #3' THEN 'APRA CPS 234 Third-Party Amendment — Software Supply Chain Controls'
    WHEN 'APRA prudential update #4' THEN 'APRA GPS 001 Climate Risk Integration — Stress Testing Requirements'
    WHEN 'APRA prudential update #5' THEN 'APRA CPS 231 Outsourcing — Material Data Processing Offshore'
    WHEN 'APRA prudential update #6' THEN 'APRA Supervisory Priorities 2024-25 — Cyber Uplift and Stress Testing'
    WHEN 'APRA prudential update #7' THEN 'APRA Financial Accountability Regime — FAR Implementation Guidance'
    WHEN 'APRA prudential update #8' THEN 'APRA CPS 220 Risk Management — AI and ML Model Risk Addendum'
    -- EU (European Commission)
    WHEN 'EU technical standard #1' THEN 'DORA Level 2 RTS on ICT Risk Management Framework — Final Text'
    WHEN 'EU technical standard #2' THEN 'EU AI Act Article 9 Technical Standards — Financial System Classification'
    WHEN 'EU technical standard #3' THEN 'NIS2 Directive Implementing Regulation on Incident Reporting Timelines'
    WHEN 'EU technical standard #4' THEN 'EU AI Act Annex III Classification of High-Risk Credit Scoring Systems'
    WHEN 'EU technical standard #5' THEN 'DORA RTS on Information Register for Third-Party ICT Providers'
    WHEN 'EU technical standard #6' THEN 'GDPR Guidance on Automated Decision-Making in Financial Services'
    WHEN 'EU technical standard #7' THEN 'EU Cyber Resilience Act — Connected Financial Product Requirements'
    WHEN 'EU technical standard #8' THEN 'DORA ICT Third-Party Risk — Enhanced Due Diligence for Critical ICT Providers'
    -- OJK (Otoritas Jasa Keuangan)
    WHEN 'OJK regulation revision #1' THEN 'POJK No. 11/2023 Revision — Digital Banking Operations Technology Standards'
    WHEN 'OJK regulation revision #2' THEN 'POJK Cyber Security for Financial Institutions 2024 — SOC Requirement'
    WHEN 'OJK regulation revision #3' THEN 'OJK Circular on Cloud Service Adoption — Local Data Storage Exemption'
    WHEN 'OJK regulation revision #4' THEN 'POJK No. 5/2024 — Anti-Money Laundering RegTech Adoption Mandate'
    WHEN 'OJK regulation revision #5' THEN 'OJK SEOJK IT Risk Management Systems for Multifinance'
    WHEN 'OJK regulation revision #6' THEN 'OJK Open Banking API Security Standards — FAPI Compliance'
    WHEN 'OJK regulation revision #7' THEN 'POJK on Credit Risk — AI and Alternative Data Scoring Controls'
    WHEN 'OJK regulation revision #8' THEN 'POJK Consumer Protection — Digital Financial Services Interface Standards'
    -- RBI (Reserve Bank of India)
    WHEN 'RBI cyber directive #1' THEN 'RBI Master Directions on IT Framework — Cyber Security Controls Update'
    WHEN 'RBI cyber directive #2' THEN 'RBI Circular on Cloud Risk Management for Banking Operations'
    WHEN 'RBI cyber directive #3' THEN 'RBI Data Localisation — Payment System Operators Storage Clarification'
    WHEN 'RBI cyber directive #4' THEN 'RBI Draft Guidelines on AI/ML in Credit Risk — Model Governance'
    WHEN 'RBI cyber directive #5' THEN 'RBI Regulatory Sandbox Cohort 5 — Cybersecurity Technology Applications'
    WHEN 'RBI cyber directive #6' THEN 'RBI CBDC e-Rupee Interoperability Framework — Security Standards'
    WHEN 'RBI cyber directive #7' THEN 'RBI Authentication Guidelines — Transaction Risk-Based Monitoring Update'
    WHEN 'RBI cyber directive #8' THEN 'RBI Guidance Note on Operational Resilience — Third-Party ICT Dependencies'
    -- HKMA (Hong Kong Monetary Authority)
    WHEN 'HKMA circular #1' THEN 'HKMA Cybersecurity Fortification Initiative CFI 2.0 — CTSP Compliance Assessment'
    WHEN 'HKMA circular #2' THEN 'HKMA Supervisory Policy Manual TM-G-1 Update — Cloud Computing Governance'
    WHEN 'HKMA circular #3' THEN 'HKMA Circular on Responsible Use of AI in Banking — Explainability Requirements'
    WHEN 'HKMA circular #4' THEN 'HKMA Digital Resilience Framework — Sector-Wide Simulation Exercise Mandate'
    WHEN 'HKMA circular #5' THEN 'HKMA Fintech Supervisory Sandbox iAML Extension — 24-Month Cohort'
    WHEN 'HKMA circular #6' THEN 'HKMA Cross-Border Data Flow Policy — Permitted Transfers for Financial Supervisory Purposes'
    WHEN 'HKMA circular #7' THEN 'HKMA AML/CFT Supervisory Notice — Virtual Asset Intermediary Controls'
    WHEN 'HKMA circular #8' THEN 'HKMA Supervisory Update on Model Risk Management for IRB and AIRB Models'
    -- PDPC SG (Personal Data Protection Commission SG)
    WHEN 'PDPC update #1' THEN 'PDPC Advisory Guidelines on AI — Recommendation Systems in Financial Services'
    WHEN 'PDPC update #2' THEN 'PDPC Enforcement Direction — Financial Sector Data Breach Notification Timeliness'
    WHEN 'PDPC update #3' THEN 'PDPC Guide on Data Protection Practices for Digital Financial Services'
    WHEN 'PDPC update #4' THEN 'PDPC Mandatory Data Protection Officer Requirements — Enhanced Annual Review'
    WHEN 'PDPC update #5' THEN 'PDPC NRIC Handling Guidance — Identity Data in Financial Onboarding Revised'
    WHEN 'PDPC update #6' THEN 'PDPC Research Publication — Privacy-Enhancing Technologies for Financial Data Sharing'
    WHEN 'PDPC update #7' THEN 'PDPC Advisory Guidelines — International Data Transfers and Binding Corporate Rules'
    WHEN 'PDPC update #8' THEN 'PDPC Financial Penalty Framework — Repeat Offender Provisions'
    ELSE title
  END,
  summary = CASE title
    -- MAS
    WHEN 'MAS update #1' THEN $rw$MAS has issued a consultation paper proposing mandatory digital resilience standards for all MAS-regulated institutions. The paper introduces tiered recovery time objectives and requires institutions to maintain offline backup capability. Financial institutions must submit feedback by 30 July 2025.$rw$
    WHEN 'MAS update #2' THEN $rw$MAS has amended Notice 644 to extend cybersecurity obligations to licensed digital payment token service providers. Providers must implement multi-factor authentication for all customer-facing interfaces and undergo annual penetration testing. The amendment takes effect 1 January 2026.$rw$
    WHEN 'MAS update #3' THEN $rw$MAS has published guidance for financial institutions on climate transition finance disclosures under the SFCS framework. Institutions are expected to align green loan and sustainability-linked lending with the Singapore-Asia Taxonomy. Boards must formally approve climate transition plans by end-2025.$rw$
    WHEN 'MAS update #4' THEN $rw$MAS has revised thresholds under Notice 655 for classifying outsourcing arrangements as 'critical'. The revised definition now explicitly includes cloud hyperscalers hosting core banking systems. Affected institutions must reassess their material outsourcing register within 90 days of publication.$rw$
    WHEN 'MAS update #5' THEN $rw$MAS has issued a supervisory notice requiring all FIs to maintain a complete inventory of third-party software components and address critical CVEs within 14 days. The notice is a response to supply-chain incidents affecting regional financial institutions. Non-compliance may result in supervisory action under the Financial Services and Markets Act 2022.$rw$
    WHEN 'MAS update #6' THEN $rw$MAS has released a proposed governance framework for AI systems used in financial decision-making, aligned with the FEAT principles. Institutions deploying AI for credit scoring or fraud detection must conduct bias audits and maintain explainability logs. A 60-day consultation period closes 15 August 2025.$rw$
    WHEN 'MAS update #7' THEN $rw$MAS has issued an update to the TRM Guidelines 2021 specifying post-quantum cryptography readiness milestones. Institutions must complete a cryptographic inventory and submit a migration roadmap to MAS by Q4 2025. The update references NIST SP 800-208 and NIST PQC standards.$rw$
    WHEN 'MAS update #8' THEN $rw$MAS has updated Notice 626 to strengthen recovery time objectives for straight-through processing systems to 4 hours for tier-1 institutions. Disaster recovery tests must now include simulated ransomware scenarios. Institutions must submit updated BCP plans by 31 March 2026.$rw$
    -- APRA
    WHEN 'APRA prudential update #1' THEN $rw$APRA's final CPS 230 standard on operational risk management came into force 1 July 2025 for all ADIs, insurers, and RSE licensees. Entities must demonstrate board-approved operational risk appetite statements and service provider management frameworks. Non-compliance assessments will begin from the first supervisory cycle post-effective date.$rw$
    WHEN 'APRA prudential update #2' THEN $rw$APRA has updated CPG 235 guidance to address data risk in multi-cloud and hybrid cloud environments, covering data sovereignty, encryption key custody, and egress controls. Entities with material cloud workloads must conduct a data risk assessment against the updated guidance by end-2025. Third-party audits are encouraged for entities with critical data in hyperscaler environments.$rw$
    WHEN 'APRA prudential update #3' THEN $rw$APRA has amended CPS 234 to clarify expectations for software supply chain risk, requiring entities to assess open-source dependencies and maintain SBOMs. Regulated entities must update their information security capability assessments to address software composition risks. The amendment aligns with CISA SBOM guidance and ISO/IEC 5230.$rw$
    WHEN 'APRA prudential update #4' THEN $rw$APRA has issued binding prudential requirements under GPS 001 for climate scenario stress testing across the general insurance sector. Insurers must model acute and chronic physical risk scenarios using NGFS climate pathways. Climate stress test results must be reported to APRA in the 2025 annual capital adequacy return.$rw$
    WHEN 'APRA prudential update #5' THEN $rw$APRA has revised CPS 231 to require prior notification for offshore processing of material data by ADIs and RSE licensees. Data sovereignty assessments must address jurisdiction-specific legal compulsion risks in China, India, and the US. Entities must review existing offshore arrangements and update material risk assessments within 6 months.$rw$
    WHEN 'APRA prudential update #6' THEN $rw$APRA has published its supervisory priorities for 2024-25, with a strong focus on cyber resilience uplift and stress testing of operational risk frameworks. Entities rated below the cyber resilience benchmark in the most recent APRA assessment must submit a remediation plan within 60 days. APRA will conduct targeted reviews of crisis simulation exercises in H2 2025.$rw$
    WHEN 'APRA prudential update #7' THEN $rw$APRA and ASIC have released joint implementation guidance for the Financial Accountability Regime (FAR) expanding accountability obligations to non-major ADIs and insurers from March 2025. Regulated entities must register accountable persons and maintain accountability statements and maps. Breaches of FAR obligations may result in civil penalties of up to AUD 18.5 million.$rw$
    WHEN 'APRA prudential update #8' THEN $rw$APRA has issued a model risk addendum to CPS 220 addressing the governance of AI/ML models in credit risk, provisioning, and capital calculations. Entities must establish model risk management frameworks consistent with SR 11-7 guidance adapted for Australia. Material AI models must undergo independent validation before deployment in capital-sensitive processes.$rw$
    -- EU
    WHEN 'EU technical standard #1' THEN $rw$The ESAs have published the final Regulatory Technical Standards on ICT risk management under DORA, effective 17 January 2025. In-scope entities must implement ICT risk frameworks covering ICT asset management, threat-led penetration testing, and third-party concentration risk. Entities must complete a gap assessment against the RTS by Q2 2025.$rw$
    WHEN 'EU technical standard #2' THEN $rw$The European Commission has published delegated regulations under EU AI Act Article 9 classifying AI systems used in credit scoring and financial product recommendation as high-risk. Financial institutions using such systems must register them in the EU AI database and maintain conformity assessments. The classification takes effect 2 August 2026 for existing deployed systems.$rw$
    WHEN 'EU technical standard #3' THEN $rw$The European Commission has adopted implementing regulations specifying NIS2 incident reporting requirements: initial notification within 24 hours, intermediate within 72 hours, and final report within 30 days. Essential entities in the financial sector must designate a NIS2 compliance officer and submit incident notification procedures to their NCA by 17 October 2025. Penalties for non-compliance reach up to €10 million or 2% of global turnover.$rw$
    WHEN 'EU technical standard #4' THEN $rw$The Commission has clarified that all automated credit scoring systems for retail customers are classified as high-risk under Annex III of the EU AI Act. Financial institutions must implement bias monitoring, human oversight mechanisms, and explainability documentation. Non-compliant systems must be withdrawn from the EU market by August 2026 pending conformity assessment.$rw$
    WHEN 'EU technical standard #5' THEN $rw$The ESAs have finalised the template for the contractual information register on third-party ICT providers under DORA Article 28. In-scope entities must maintain the register covering all ICT sub-outsourcing chains to at least 2 tiers and submit it to their competent authority by April 2025. Non-EU cloud providers serving EU financial entities must designate an EU representative in the register.$rw$
    WHEN 'EU technical standard #6' THEN $rw$The EDPB has issued guidance on Article 22 GDPR compliance for automated financial decisions including loan refusals and insurance pricing. Data subjects must be offered meaningful human review of automated decisions affecting their financial status. Institutions must review their privacy notices and model cards for AI systems in scope by end-2025.$rw$
    WHEN 'EU technical standard #7' THEN $rw$The Cyber Resilience Act has been published, imposing mandatory cybersecurity requirements for products with digital elements sold in the EU, including fintech hardware and IoT devices. Financial technology product manufacturers must achieve CE marking for connected devices by 11 December 2027. Vulnerability disclosure programmes and SBOM publication are mandatory under Annex I.$rw$
    WHEN 'EU technical standard #8' THEN $rw$DORA's enhanced due diligence requirements for critical third-party ICT providers (CTTPPs) designated by the ESAs come into effect January 2025. In-scope financial entities must renegotiate contracts with CTTPPs to include exit strategies and audit rights within 12 months. The JON designation list identifies major cloud providers including AWS, Azure, and Google Cloud as CTTPPs.$rw$
    -- OJK
    WHEN 'OJK regulation revision #1' THEN $rw$OJK has revised POJK No. 11/2023 to update technology risk standards for digital banks, including mandatory penetration testing for mobile banking applications twice annually. Digital banks must implement automated anomaly detection and real-time fraud monitoring systems by Q3 2025. Non-compliant institutions may face operational restrictions under OJK supervisory authority.$rw$
    WHEN 'OJK regulation revision #2' THEN $rw$OJK has mandated that all bank umum and multifinance with total assets above IDR 10 trillion establish a Security Operations Centre (SOC) by end-2025. SOC requirements include 24/7 monitoring, cyber threat intelligence feeds, and quarterly reporting to OJK DPBS. Smaller institutions may partner with licensed MSSPs to meet the requirement.$rw$
    WHEN 'OJK regulation revision #3' THEN $rw$OJK has issued a circular allowing national strategic data categories to be stored in government-certified local cloud facilities without requiring OJK pre-approval. Financial institutions using cloud services for non-critical functions may now adopt internationally certified providers subject to annual supervisory reporting. The circular reduces administrative burden for cloud adoption while maintaining data sovereignty standards.$rw$
    WHEN 'OJK regulation revision #4' THEN $rw$OJK has issued a mandatory regulation requiring all banks, securities companies, and insurance firms to adopt regulatory technology solutions for AML transaction monitoring by January 2026. Solutions must interface with PPATK's goAML system and support automated suspicious transaction reporting. OJK will publish an approved vendor list for AML RegTech solutions by July 2025.$rw$
    WHEN 'OJK regulation revision #5' THEN $rw$OJK has issued a supervisory circular mandating IT risk management systems for multifinance companies with assets above IDR 1 trillion. Systems must cover ICT asset inventory, vulnerability management, and incident response capabilities. Compliance assessments will begin from Q1 2026 during OJK routine supervision visits.$rw$
    WHEN 'OJK regulation revision #6' THEN $rw$OJK has adopted Financial-grade API (FAPI) security profiles as the mandatory standard for open banking implementations in Indonesia. All banks participating in the Bank Indonesia open API framework must complete FAPI 2.0 certification by June 2026. API security assessments must be submitted to OJK for third-party data sharing arrangements.$rw$
    WHEN 'OJK regulation revision #7' THEN $rw$OJK has issued guidance on permissible use of AI and alternative data in credit scoring models for banks and digital lending platforms. Models using social media or transaction behavioral data must demonstrate fairness and non-discrimination in line with OJK consumer protection principles. Model validation reports are required before deployment of new credit scoring systems.$rw$
    WHEN 'OJK regulation revision #8' THEN $rw$OJK has strengthened consumer protection standards for digital financial service interfaces, banning dark patterns and requiring informed consent flows. All digital customer onboarding must comply with updated e-KYC standards using OJK-approved identity verification providers. Institutions have 12 months from publication to update their digital interface documentation and submit to OJK.$rw$
    -- RBI
    WHEN 'RBI cyber directive #1' THEN $rw$RBI has updated its Master Directions on IT Framework to incorporate cybersecurity controls aligned with NIST CSF 2.0 and ISO/IEC 27001:2022. Regulated entities must complete a gap assessment and implement mandatory controls within 12 months, with board-level cyber risk review quarterly. RBI has also introduced a cybersecurity risk rating framework for scheduled commercial banks.$rw$
    WHEN 'RBI cyber directive #2' THEN $rw$RBI has issued a circular on cloud risk management requiring SCBs to obtain prior approval for migration of critical payment and core banking systems to the cloud. A cloud security framework must cover data classification, encryption key custody within India, and cloud exit strategy. Banks must submit a cloud adoption roadmap to RBI by 31 December 2025.$rw$
    WHEN 'RBI cyber directive #3' THEN $rw$RBI has issued a clarification on data localisation requirements for payment system operators, confirming that mirror copies stored abroad for DR purposes are permissible provided the primary copy remains in India. Payment data includes complete end-to-end transaction data and must be stored in RBI-compliant data centres. Operators must annually certify compliance with the RBI Data Localisation directive.$rw$
    WHEN 'RBI cyber directive #4' THEN $rw$RBI has released draft guidelines on the use of artificial intelligence and machine learning in credit risk assessment for banks and NBFCs. Guidelines require independent model validation, board approval of AI risk appetite, and quarterly monitoring reports on model performance. Banks must establish an AI/ML steering committee with CISO representation by 1 April 2026.$rw$
    WHEN 'RBI cyber directive #5' THEN $rw$RBI has announced Cohort 5 of the Regulatory Sandbox focused on cybersecurity technologies for fraud prevention, identity verification, and quantum-safe cryptography. Selected entities will operate under a sandbox for 12 months with relaxed regulatory requirements to test innovative cybersecurity solutions. Applications from fintechs and technology providers are open until 15 August 2025.$rw$
    WHEN 'RBI cyber directive #6' THEN $rw$RBI has published the technical security standards for the digital rupee (CBDC) interoperability framework, covering API security, wallet encryption, and transaction authentication. Participating banks must implement hardware security modules (HSMs) for CBDC key management and complete certification by end-2025. The standards reference NIST SP 800-57 Part 1 for key lifecycle management.$rw$
    WHEN 'RBI cyber directive #7' THEN $rw$RBI has updated transaction authentication guidelines for internet and mobile banking, mandating risk-based authentication for high-value IMPS and RTGS transactions. Banks must implement device binding, behavioural biometrics, and velocity checks for transactions above INR 5 lakh. Mandatory compliance date is 1 October 2025 for all SCBs.$rw$
    WHEN 'RBI cyber directive #8' THEN $rw$RBI has issued a guidance note on operational resilience for SCBs, requiring mapping of third-party ICT dependencies in critical business services. Banks must demonstrate recovery capability for scenarios involving simultaneous failure of two critical third-party ICT providers. Scenario-based resilience tests must be completed by 31 March 2026 and results submitted to RBI.$rw$
    -- HKMA
    WHEN 'HKMA circular #1' THEN $rw$HKMA has launched CFI 2.0 with an updated Cyber Threat Susceptibility Profile (CTSP) framework and new maturity model for authorized institutions. AIs must complete a new baseline assessment against CFI 2.0 standards by 31 March 2025 and develop a 3-year cyber uplift roadmap. Threat-Led Penetration Testing (TLPT) under the iCAST programme is mandatory for tier-1 institutions.$rw$
    WHEN 'HKMA circular #2' THEN $rw$HKMA has issued an updated Supervisory Policy Manual module TM-G-1 on cloud computing, covering data residency, outsourcing risk, and exit management. AIs using cloud services for critical systems must maintain documented cloud concentration risk assessments. Updated annual outsourcing register submissions to HKMA must now include cloud platform details.$rw$
    WHEN 'HKMA circular #3' THEN $rw$HKMA has issued a circular on responsible AI use for authorized institutions, requiring explainability documentation for AI systems used in credit decisions and AML/CFT. Institutions must establish an AI Ethics Committee or equivalent governance body and publish an AI ethics policy. An industry self-assessment against HKMA AI principles is expected by mid-2025.$rw$
    WHEN 'HKMA circular #4' THEN $rw$HKMA has mandated a sector-wide cyber resilience simulation exercise for authorized institutions focusing on ransomware and cloud service outage scenarios. AIs must participate in at least one industry simulation exercise annually and submit a lessons-learned report to HKMA within 30 days. The first mandatory exercise is scheduled for November 2025 in partnership with the HKMA-led Crisis Management Group.$rw$
    WHEN 'HKMA circular #5' THEN $rw$HKMA has extended the Fintech Supervisory Sandbox to include innovative AML/CFT technologies for a 24-month cohort. Participating institutions can test privacy-preserving analytics and federated learning for transaction monitoring without full regulatory compliance for the sandbox period. Applications for the iAML cohort close 30 September 2025.$rw$
    WHEN 'HKMA circular #6' THEN $rw$HKMA has published guidance clarifying permitted cross-border data flows for financial institutions sharing supervisory data with overseas regulators. Data shared for AML/CFT, sanctions screening, and macro-prudential purposes is exempt from PDPO transfer restrictions under section 33A. Institutions must document cross-border data flows in their data protection impact assessments.$rw$
    WHEN 'HKMA circular #7' THEN $rw$HKMA has issued a supervisory notice on AML/CFT controls for authorized institutions providing virtual asset dealing or advisory services. Enhanced customer due diligence is required for virtual asset transactions above HKD 8,000 and all transactions involving non-custodial wallet addresses. Institutions must file Suspicious Transaction Reports within 24 hours for flagged VA transactions.$rw$
    WHEN 'HKMA circular #8' THEN $rw$HKMA has updated expectations for model risk management covering internal ratings-based (IRB) credit models used in capital calculations. AIs using AIRB models must conduct independent model validation annually and maintain challenger model programmes. HKMA will conduct targeted reviews of model risk governance frameworks in H2 2025.$rw$
    -- PDPC SG
    WHEN 'PDPC update #1' THEN $rw$The PDPC has issued advisory guidelines on responsible AI, focusing on algorithmic recommendation systems used by financial institutions for product cross-selling. Institutions must implement opt-out mechanisms for profiling-based product recommendations and provide transparency notices at point of interaction. A compliance checklist for recommendation system operators is available on the PDPC website.$rw$
    WHEN 'PDPC update #2' THEN $rw$The PDPC has issued an enforcement direction following investigations into multiple financial sector data breaches where notification timelines exceeded the mandatory 3-business-day requirement. Financial institutions are reminded that the Personal Data Protection (Amendment) Act 2020 requires notification for breaches affecting 500 or more individuals within 3 business days of assessment. Recurring non-compliance may result in financial penalties up to S$1 million.$rw$
    WHEN 'PDPC update #3' THEN $rw$The PDPC has published a sector-specific guide on data protection for digital financial services including neobanks, P2P lenders, and insurtech platforms. Key recommendations include privacy-by-design implementation, data minimisation for e-KYC, and consent management for behavioural analytics. The guide supplements MAS TRM Guidelines and should be read together with PDPC's Accountability and Transparency Advisory.$rw$
    WHEN 'PDPC update #4' THEN $rw$The PDPC has strengthened requirements for Data Protection Officers (DPOs) in financial institutions, mandating annual DPO competency assessments and public disclosure of DPO contact details. Organisations with more than 250 employees in Singapore must register their DPO with the PDPC by 31 January 2026. The PDPC's online DPO Competency Framework Assessment tool must be used for the annual review.$rw$
    WHEN 'PDPC update #5' THEN $rw$The PDPC has revised its advisory on NRIC collection in financial customer onboarding, permitting collection for MAS-regulated KYC purposes without prior consent. However, NRIC data must be treated as sensitive personal data with enhanced retention controls and access logging. Financial institutions must update their data protection impact assessments for onboarding processes by 30 June 2025.$rw$
    WHEN 'PDPC update #6' THEN $rw$The PDPC has published research on privacy-enhancing technologies (PETs) suitable for financial data sharing in the MAS Open Banking framework. Technologies covered include differential privacy, synthetic data generation, secure multi-party computation, and homomorphic encryption. The publication includes implementation guidance for financial institutions piloting PETs in data analytics.$rw$
    WHEN 'PDPC update #7' THEN $rw$The PDPC has updated advisory guidelines on international data transfers, introducing a model for Binding Corporate Rules (BCRs) for multinational financial groups with Singapore operations. Financial groups may use BCRs as an adequacy mechanism for intragroup transfers subject to PDPC approval. Applications for BCR recognition must be submitted by 1 September 2025 to qualify for the first assessment cycle.$rw$
    WHEN 'PDPC update #8' THEN $rw$The PDPC has announced a revised penalty framework under section 48J of the PDPA for repeat offenders in the financial sector, with penalties scaling to S$1 million for third and subsequent breaches within a 5-year period. Mitigating factors include voluntary notification, prior compliance investment, and DPO certification. The framework applies to investigations commenced after 1 October 2025.$rw$
    ELSE summary
  END
WHERE title ~ '#[0-9]+$';

-- =============================================================================
-- Part 2: risk.risks — pattern-based description update
-- =============================================================================

UPDATE risk.risks
SET description =
  trim(regexp_replace(title, '\s*#\d+$', '')) ||
  ' presents a ' || residual_severity::text || '-severity risk exposure. ' ||
  CASE category::text
    WHEN 'technology'    THEN 'Technology controls, access management, and continuous monitoring reduce inherent exposure to residual tolerance.'
    WHEN 'third-party'   THEN 'Vendor due diligence, contractual protections, and ongoing third-party monitoring mitigate concentration risk.'
    WHEN 'regulatory'    THEN 'Compliance monitoring, regulatory horizon scanning, and policy alignment manage this exposure.'
    WHEN 'financial'     THEN 'Financial controls, limit frameworks, and stress testing constrain potential loss materialisation.'
    WHEN 'operational'   THEN 'Process controls, segregation of duties, and four-eyes verification reduce frequency and impact.'
    WHEN 'people'        THEN 'Awareness training, insider threat monitoring, and HR controls address this exposure.'
    WHEN 'privacy'       THEN 'Data governance, consent management, and technical controls align with PDPA obligations.'
    WHEN 'ai'            THEN 'AI governance including model validation, bias testing, and human-in-the-loop oversight manages this risk.'
    ELSE                      'Risk controls and management monitoring reduce exposure to within board-approved risk appetite.'
  END
WHERE description LIKE '%Auto-generated demo risk%';

-- =============================================================================
-- Part 3: audit.findings — pattern-based description update
-- =============================================================================

UPDATE audit.findings
SET description =
  title || ' — identified during audit fieldwork procedures. ' ||
  CASE severity::text
    WHEN 'critical' THEN 'Immediate escalation to CISO and Audit Committee required. Remediation plan due within 15 days.'
    WHEN 'high'     THEN 'Remediation required within 30 days per findings resolution policy. Assigned to named control owner.'
    WHEN 'medium'   THEN 'Management remediation plan required within 90 days. Tracked in the issue register and reported monthly.'
    WHEN 'low'      THEN 'Management noted. Remediation or acceptance within 180 days or the next annual review cycle.'
    ELSE                  'Remediation tracked via the issue register. Status reviewed at next audit committee meeting.'
  END
WHERE description LIKE '%Auto-seeded finding%';

-- =============================================================================
-- Part 4: regwatch.impact_assessments — notes update
-- =============================================================================

UPDATE regwatch.impact_assessments
SET notes =
  'Assessment conducted by Regulatory Horizon Scanner agent. ' ||
  gaps_opened::text || ' control gap(s) identified requiring remediation action. ' ||
  'Affected policies and control mappings have been flagged for owner review and update within the next review cycle.'
WHERE notes LIKE '%Auto-seeded%';
