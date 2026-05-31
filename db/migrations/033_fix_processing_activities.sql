-- Migration 033: Fix processing activity purposes and lawful bases.
-- All 12 activities had the same generic "Provide regulated financial service to customer"
-- purpose regardless of what they actually are.

UPDATE privacy.processing_activities SET
  purpose = CASE name
    WHEN 'Customer onboarding KYC'   THEN 'Verify customer identity and assess risk for AML/CFT regulatory compliance under MAS Notice 626'
    WHEN 'Card payment processing'   THEN 'Process customer card transactions in accordance with payment scheme rules and MAS Notice MAS-644'
    WHEN 'Cookie consent management' THEN 'Manage user tracking preferences across web and mobile platforms under PDPA consent obligations'
    WHEN 'Customer support chats'    THEN 'Provide product support, resolve service incidents, and maintain support audit trails'
    WHEN 'Employee HR records'       THEN 'Manage employment records, payroll, benefits, and workforce administration in accordance with the Employment Act'
    WHEN 'Fraud detection'           THEN 'Detect, prevent, and investigate financial fraud, unauthorised transactions, and suspicious activity'
    WHEN 'Loan underwriting model'   THEN 'Assess creditworthiness and price credit risk for retail and SME lending decisions'
    WHEN 'Marketing email campaigns' THEN 'Send promotional offers and product updates to opted-in customers under PDPA Do Not Call provisions'
    WHEN 'Mobile app analytics'      THEN 'Understand feature usage patterns and improve application performance and security'
    WHEN 'Recruitment pipeline'      THEN 'Manage job applicant data through sourcing, assessment, and onboarding workflows'
    WHEN 'Third-party API calls'     THEN 'Share data with authorised service providers and payment networks for core product functionality'
    WHEN 'Vendor due-diligence'      THEN 'Assess third-party risk and maintain supplier compliance records under MAS Notice 655 outsourcing obligations'
    ELSE purpose
  END,
  lawful_basis = CASE name
    WHEN 'Customer onboarding KYC'   THEN 'legal-obligation'
    WHEN 'Card payment processing'   THEN 'contract'
    WHEN 'Cookie consent management' THEN 'consent'
    WHEN 'Customer support chats'    THEN 'contract'
    WHEN 'Employee HR records'       THEN 'contract'
    WHEN 'Fraud detection'           THEN 'legitimate-interests'
    WHEN 'Loan underwriting model'   THEN 'legitimate-interests'
    WHEN 'Marketing email campaigns' THEN 'consent'
    WHEN 'Mobile app analytics'      THEN 'consent'
    WHEN 'Recruitment pipeline'      THEN 'legitimate-interests'
    WHEN 'Third-party API calls'     THEN 'contract'
    WHEN 'Vendor due-diligence'      THEN 'legitimate-interests'
    ELSE lawful_basis
  END
WHERE purpose = 'Provide regulated financial service to customer';
