-- Migration 032: Fix obviously wrong vendor categories for well-known vendors
-- and replace 'EU' pseudo-country code with valid ISO-3166 codes.

-- Correct categories for well-known vendors (applied across all tenants)
UPDATE vendor.vendors SET category = 'cloud'          WHERE name = 'AWS';
UPDATE vendor.vendors SET category = 'cloud'          WHERE name = 'Google Cloud';
UPDATE vendor.vendors SET category = 'cloud'          WHERE name = 'Azure';
UPDATE vendor.vendors SET category = 'saas'           WHERE name = 'Microsoft';
UPDATE vendor.vendors SET category = 'saas'           WHERE name = 'Salesforce';
UPDATE vendor.vendors SET category = 'saas'           WHERE name = 'ServiceNow';
UPDATE vendor.vendors SET category = 'saas'           WHERE name = 'Atlassian';
UPDATE vendor.vendors SET category = 'saas'           WHERE name = 'Slack';
UPDATE vendor.vendors SET category = 'saas'           WHERE name = 'Zoom';
UPDATE vendor.vendors SET category = 'saas'           WHERE name = 'Workday';
UPDATE vendor.vendors SET category = 'saas'           WHERE name = 'GitHub';
UPDATE vendor.vendors SET category = 'saas'           WHERE name = 'GitLab';
UPDATE vendor.vendors SET category = 'saas'           WHERE name = 'Jira';
UPDATE vendor.vendors SET category = 'saas'           WHERE name = '1Password';
UPDATE vendor.vendors SET category = 'cloud'          WHERE name = 'Cloudflare';
UPDATE vendor.vendors SET category = 'security'       WHERE name = 'CrowdStrike';
UPDATE vendor.vendors SET category = 'security'       WHERE name = 'Palo Alto Networks';
UPDATE vendor.vendors SET category = 'security'       WHERE name = 'Okta';
UPDATE vendor.vendors SET category = 'security'       WHERE name = 'SentinelOne';
UPDATE vendor.vendors SET category = 'security'       WHERE name = 'Qualys';
UPDATE vendor.vendors SET category = 'security'       WHERE name = 'Rapid7';
UPDATE vendor.vendors SET category = 'security'       WHERE name = 'Tenable';
UPDATE vendor.vendors SET category = 'data-platform'  WHERE name = 'Snowflake';
UPDATE vendor.vendors SET category = 'data-platform'  WHERE name = 'Databricks';
UPDATE vendor.vendors SET category = 'data-platform'  WHERE name = 'Datadog';
UPDATE vendor.vendors SET category = 'data-platform'  WHERE name = 'Splunk';
UPDATE vendor.vendors SET category = 'data-platform'  WHERE name = 'New Relic';
UPDATE vendor.vendors SET category = 'managed-service' WHERE name = 'Accenture';
UPDATE vendor.vendors SET category = 'managed-service' WHERE name = 'Deloitte';
UPDATE vendor.vendors SET category = 'managed-service' WHERE name = 'PwC';
UPDATE vendor.vendors SET category = 'managed-service' WHERE name = 'KPMG';
UPDATE vendor.vendors SET category = 'managed-service' WHERE name = 'EY';
UPDATE vendor.vendors SET category = 'consulting'     WHERE name = 'IBM';
UPDATE vendor.vendors SET category = 'communications' WHERE name = 'Twilio';
UPDATE vendor.vendors SET category = 'communications' WHERE name = 'SendGrid';
UPDATE vendor.vendors SET category = 'cloud'          WHERE name = 'HashiCorp';
UPDATE vendor.vendors SET category = 'saas'           WHERE name = 'Auth0';
UPDATE vendor.vendors SET category = 'cloud'          WHERE name = 'Terraform';

-- Fix 'EU' pseudo-country: use 'IE' (Ireland, where many US tech companies EU-HQ)
-- Stripe, Airbnb etc. are Irish-registered. Generic EU vendors → IE.
UPDATE vendor.vendors SET hq_country = 'IE' WHERE hq_country = 'EU';
