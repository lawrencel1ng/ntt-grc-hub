-- Migration 100: Replace synthetic subject-request email addresses with realistic
-- Singapore personal-email identities.  Affects two groups:
--
--   1. subject1–14@example.com  (42 rows across t_grab, t_maybank, t_mindef)
--      → realistic gmail / hotmail / yahoo.com.sg personal addresses
--
--   2. @example.sg domain addresses (6 rows across remaining tenants)
--      → appropriate realistic free-mail equivalents

-- ── subject1-14@example.com ──────────────────────────────────────────────────
UPDATE privacy.subject_requests
SET requester_email = CASE requester_email
  WHEN 'subject1@example.com'  THEN 'james.lim.sg@gmail.com'
  WHEN 'subject2@example.com'  THEN 'sarah.tan8@hotmail.com'
  WHEN 'subject3@example.com'  THEN 'weiming.chua@yahoo.com.sg'
  WHEN 'subject4@example.com'  THEN 'pradeep.raj99@gmail.com'
  WHEN 'subject5@example.com'  THEN 'linda.koh.sg@gmail.com'
  WHEN 'subject6@example.com'  THEN 'farhan.ahmad@gmail.com'
  WHEN 'subject7@example.com'  THEN 'jasmine.ng88@hotmail.com'
  WHEN 'subject8@example.com'  THEN 'david.chen.sg@gmail.com'
  WHEN 'subject9@example.com'  THEN 'nurul.aisyah@yahoo.com.sg'
  WHEN 'subject10@example.com' THEN 'michael.teo@gmail.com'
  WHEN 'subject11@example.com' THEN 'amy.zhang.sg@gmail.com'
  WHEN 'subject12@example.com' THEN 'rizal.hassan@hotmail.com'
  WHEN 'subject13@example.com' THEN 'grace.lee.sg@gmail.com'
  WHEN 'subject14@example.com' THEN 'peter.yip@yahoo.com.sg'
END
WHERE requester_email LIKE 'subject%@example.com';

-- ── @example.sg domain addresses ─────────────────────────────────────────────
UPDATE privacy.subject_requests SET requester_email = 'chen.lab.research@gmail.com'
  WHERE requester_email = 'lab.technician@example.sg';

UPDATE privacy.subject_requests SET requester_email = 'sg.resident.privacy@gmail.com'
  WHERE requester_email = 'resident@example.sg';

UPDATE privacy.subject_requests SET requester_email = 'founder.sgtech@gmail.com'
  WHERE requester_email = 'startup.founder@example.sg';

UPDATE privacy.subject_requests SET requester_email = 'media.dsar@gmail.com'
  WHERE requester_email = 'data.rights@example.sg';

UPDATE privacy.subject_requests SET requester_email = 'patient.rights.sg@gmail.com'
  WHERE requester_email = 'patient.advocate@example.sg';

UPDATE privacy.subject_requests SET requester_email = 'corp.dpo.contact@outlook.com'
  WHERE requester_email = 'enterprise.dpo@example.sg';

\echo ' >> privacy subject request emails updated to realistic personal addresses'
