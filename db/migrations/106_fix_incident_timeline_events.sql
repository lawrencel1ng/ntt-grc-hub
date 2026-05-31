-- Migration 106: Fix incident.timeline_events — wrong source values and hardcoded ticket number.
--
-- Three actor↔source mismatches were seeded:
--   - 'Incident Investigator agent' had source='human'  (should be 'agent')
--   - 'Control Tester agent'        had source='system' (should be 'agent'), and
--     "Engaged vendor support" is not an action this agent performs — re-assign
--     to human actor 'vendor-liaison' with source='human'
--   - 'On-call SRE'                 had source='agent'  (should be 'human')
--
-- Additionally, all "Engaged vendor support" events contained the hardcoded
-- placeholder "ticket #12345".  Replace with varied ticket numbers using
-- MOD arithmetic on the bigint id.

-- ── Fix: Incident Investigator agent source ──────────────────────────────────
UPDATE incident.timeline_events
SET source = 'agent'
WHERE actor = 'Incident Investigator agent'
  AND source = 'human';

-- ── Fix: On-call SRE source ──────────────────────────────────────────────────
UPDATE incident.timeline_events
SET source = 'human'
WHERE actor = 'On-call SRE'
  AND source = 'agent';

-- ── Fix: Control Tester agent → vendor-liaison, vary ticket numbers ──────────
-- "Control Tester agent" doesn't engage vendors; reassign to the human
-- vendor-liaison role and correct the source while also diversifying the
-- hardcoded "#12345" placeholder with realistic ServiceNow-style ticket IDs.
UPDATE incident.timeline_events
SET
  actor  = 'vendor-liaison',
  source = 'human',
  event  = 'Engaged vendor support — ticket ' ||
           CASE (id % 10)
             WHEN 0 THEN 'INC0031245'
             WHEN 1 THEN 'INC0047823'
             WHEN 2 THEN 'INC0059104'
             WHEN 3 THEN 'INC0063917'
             WHEN 4 THEN 'INC0071538'
             WHEN 5 THEN 'INC0084266'
             WHEN 6 THEN 'INC0092741'
             WHEN 7 THEN 'INC0105392'
             WHEN 8 THEN 'INC0118047'
             ELSE       'INC0126584'
           END
WHERE actor  = 'Control Tester agent'
  AND event  = 'Engaged vendor support — ticket #12345';

\echo ' >> incident.timeline_events: source values corrected, ticket numbers diversified'
