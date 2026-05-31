-- Migration 047: Replace identical compliance attestation text with
-- framework-specific attestation language.
-- Idempotent: WHERE matches exact original placeholder.

UPDATE compliance.attestations
SET attestation_text = CASE framework_id
  WHEN 'iso-27001'
    THEN $at1$We attest that the Information Security Management System (ISMS) for the defined scope has been implemented, maintained, and operated in conformity with the requirements of ISO/IEC 27001:2022 as of the signing date. Internal audits and management reviews have been conducted in accordance with the standard. The Statement of Applicability has been reviewed, and all applicable controls are implemented or formally accepted. Continuous improvement actions are tracked in the corrective action register.$at1$
  WHEN 'gdpr'
    THEN $at2$We attest that the organisation's personal data processing activities comply with the applicable obligations of the EU General Data Protection Regulation (Regulation (EU) 2016/679) and the Singapore Personal Data Protection Act 2012 as of the signing date. Data Protection Impact Assessments have been conducted for high-risk processing activities. Appropriate technical and organisational measures are in place to safeguard personal data, and data subject rights procedures are operational.$at2$
  WHEN 'eu-ai-act'
    THEN $at3$We attest that the AI systems operated within scope by this organisation have been assessed, classified, and managed in accordance with the EU Artificial Intelligence Act (Regulation (EU) 2024/1689) as of the signing date. High-risk AI systems are registered in the EU AI database, subject to conformity assessment, and operate with appropriate human oversight mechanisms. Technical documentation and post-market monitoring plans are in place and current.$at3$
  WHEN 'nist-csf'
    THEN $at4$We attest that the organisation's cybersecurity programme is aligned with the NIST Cybersecurity Framework 2.0 across all five core functions — Govern, Identify, Protect, Detect, Respond, and Recover — as of the signing date. A current profile assessment has been completed, target profile gaps have been identified, and a remediation roadmap has been approved by the CISO. Programme maturity is reviewed quarterly by the Cyber Risk Committee.$at4$
  WHEN 'mas-trm'
    THEN $at5$We attest that the organisation's Technology Risk Management framework, policies, and controls comply with the requirements of the MAS Technology Risk Management Guidelines (2021) as of the signing date. The Board and Senior Management have reviewed and approved the Technology Risk Management policy. Third-party technology service providers have been assessed, and material outsourcing arrangements are managed in accordance with MAS requirements.$at5$
  WHEN 'mas-notice-655'
    THEN $at6$We attest that the organisation's outsourcing and third-party risk management arrangements comply with the requirements of MAS Notice 655 (Outsourcing) as of the signing date. All material outsourcing agreements have been reviewed, due diligence conducted on service providers, and exit plans documented. The outsourcing register is current and has been submitted to the Board Risk Committee for review.$at6$
  WHEN 'soc2'
    THEN $at7$We attest that the organisation's service commitments and system requirements relating to the applicable Trust Services Criteria — Security, Availability, Processing Integrity, Confidentiality, and Privacy — have been met as of the signing date and throughout the audit period. Controls are designed and operating effectively as documented in the System Description. No material changes to the control environment occurred without appropriate assessment.$at7$
  WHEN 'pci-dss-4'
    THEN $at8$We attest that the cardholder data environment and associated systems comply with the requirements of PCI DSS v4.0 as of the signing date. The scope of the cardholder data environment has been defined and validated, all applicable requirements have been assessed, and compensating controls have been documented where applicable. The organisation maintains an active PCI DSS compliance programme with quarterly vulnerability scans and annual penetration testing.$at8$
  ELSE 'We attest that the in-scope systems and processes have been assessed against the applicable compliance requirements. Controls are designed and operating effectively as of the signing date. The Board and Senior Management have reviewed and approved this attestation.'
END
WHERE attestation_text = 'We attest that the in-scope systems comply with the relevant requirements as of the signing date.';
