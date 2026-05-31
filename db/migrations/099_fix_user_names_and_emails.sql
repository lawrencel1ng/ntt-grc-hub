-- Migration 099: Replace synthetic user names ("<Company>" as surname) and
-- generic @example.sg emails with realistic Singapore professional identities.
-- Only updates the non-viewer functional accounts that appear as record owners
-- throughout the UI.  Demo login accounts (ciso@maybank.sg, etc.) are untouched.

-- ── Maybank Singapore ────────────────────────────────────────────────────────
UPDATE platform.users SET name = 'Alex Tan',      email = 'alex.tan@maybank.com.sg'      WHERE email = 'maybank.singapore.admin@example.sg';
UPDATE platform.users SET name = 'Priya Sharma',  email = 'priya.sharma@maybank.com.sg'  WHERE email = 'maybank.singapore.risk@example.sg';
UPDATE platform.users SET name = 'Kenji Wong',    email = 'kenji.wong@maybank.com.sg'    WHERE email = 'maybank.singapore.control@example.sg';
UPDATE platform.users SET name = 'Mei Loh',       email = 'mei.loh@maybank.com.sg'       WHERE email = 'maybank.singapore.auditor@example.sg';
UPDATE platform.users SET name = 'Marcus Lim',    email = 'marcus.lim@maybank.com.sg'    WHERE email = 'maybank.singapore.ops@example.sg';

-- ── Grab Fintech APAC ────────────────────────────────────────────────────────
UPDATE platform.users SET name = 'Alex Ng',       email = 'alex.ng@grab.com'             WHERE email = 'grab.fintech.apac.admin@example.sg';
UPDATE platform.users SET name = 'Priya Nair',    email = 'priya.nair@grab.com'          WHERE email = 'grab.fintech.apac.risk@example.sg';
UPDATE platform.users SET name = 'Wei Ming Lee',  email = 'weiming.lee@grab.com'         WHERE email = 'grab.fintech.apac.control@example.sg';
UPDATE platform.users SET name = 'Mei Lin Ong',   email = 'meilin.ong@grab.com'          WHERE email = 'grab.fintech.apac.auditor@example.sg';
UPDATE platform.users SET name = 'Marcus Goh',    email = 'marcus.goh@grab.com'          WHERE email = 'grab.fintech.apac.ops@example.sg';

-- ── MINDEF Defence Cloud ─────────────────────────────────────────────────────
UPDATE platform.users SET name = 'LTC Alex Yeo',  email = 'alex.yeo@defence.gov.sg'      WHERE email = 'mindef.defence.cloud.admin@example.sg';
UPDATE platform.users SET name = 'Priya Rajah',   email = 'priya.rajah@defence.gov.sg'   WHERE email = 'mindef.defence.cloud.risk@example.sg';
UPDATE platform.users SET name = 'Kenji Sng',     email = 'kenji.sng@defence.gov.sg'     WHERE email = 'mindef.defence.cloud.control@example.sg';
UPDATE platform.users SET name = 'Mei Chan',      email = 'mei.chan@defence.gov.sg'       WHERE email = 'mindef.defence.cloud.auditor@example.sg';
UPDATE platform.users SET name = 'Marcus Chua',   email = 'marcus.chua@defence.gov.sg'   WHERE email = 'mindef.defence.cloud.ops@example.sg';

-- ── SingHealth ───────────────────────────────────────────────────────────────
UPDATE platform.users SET name = 'Alex Koh',      email = 'alex.koh@singhealth.com.sg'   WHERE email = 'singhealth.admin@example.sg';
UPDATE platform.users SET name = 'Priya Pillai',  email = 'priya.pillai@singhealth.com.sg' WHERE email = 'singhealth.risk@example.sg';
UPDATE platform.users SET name = 'Kenji Teo',     email = 'kenji.teo@singhealth.com.sg'  WHERE email = 'singhealth.control@example.sg';
UPDATE platform.users SET name = 'Mei Ling Ho',   email = 'meilingho@singhealth.com.sg'  WHERE email = 'singhealth.auditor@example.sg';
UPDATE platform.users SET name = 'Marcus Seah',   email = 'marcus.seah@singhealth.com.sg' WHERE email = 'singhealth.ops@example.sg';

-- ── A*STAR ───────────────────────────────────────────────────────────────────
UPDATE platform.users SET name = 'Alex Quek',     email = 'alex.quek@a-star.edu.sg'      WHERE email = 'a*star.admin@example.sg';
UPDATE platform.users SET name = 'Priya Kumar',   email = 'priya.kumar@a-star.edu.sg'    WHERE email = 'a*star.risk@example.sg';
UPDATE platform.users SET name = 'Kenji Choo',    email = 'kenji.choo@a-star.edu.sg'     WHERE email = 'a*star.control@example.sg';
UPDATE platform.users SET name = 'Mei Ling Fu',   email = 'meiling.fu@a-star.edu.sg'     WHERE email = 'a*star.auditor@example.sg';
UPDATE platform.users SET name = 'Marcus Wee',    email = 'marcus.wee@a-star.edu.sg'     WHERE email = 'a*star.ops@example.sg';

-- ── GovTech Singapore ────────────────────────────────────────────────────────
UPDATE platform.users SET name = 'Alex Phua',     email = 'alex.phua@tech.gov.sg'        WHERE email = 'govtech.singapore.admin@example.sg';
UPDATE platform.users SET name = 'Priya Devi',    email = 'priya.devi@tech.gov.sg'       WHERE email = 'govtech.singapore.risk@example.sg';
UPDATE platform.users SET name = 'Kenji Ang',     email = 'kenji.ang@tech.gov.sg'        WHERE email = 'govtech.singapore.control@example.sg';
UPDATE platform.users SET name = 'Mei Ling Tay',  email = 'meilingtay@tech.gov.sg'       WHERE email = 'govtech.singapore.auditor@example.sg';
UPDATE platform.users SET name = 'Marcus Foo',    email = 'marcus.foo@tech.gov.sg'       WHERE email = 'govtech.singapore.ops@example.sg';

-- ── Mediacorp ────────────────────────────────────────────────────────────────
UPDATE platform.users SET name = 'Alex Heng',     email = 'alex.heng@mediacorp.com.sg'   WHERE email = 'mediacorp.admin@example.sg';
UPDATE platform.users SET name = 'Priya Menon',   email = 'priya.menon@mediacorp.com.sg' WHERE email = 'mediacorp.risk@example.sg';
UPDATE platform.users SET name = 'Kenji Bay',     email = 'kenji.bay@mediacorp.com.sg'   WHERE email = 'mediacorp.control@example.sg';
UPDATE platform.users SET name = 'Mei Ling Yap',  email = 'meilingyap@mediacorp.com.sg'  WHERE email = 'mediacorp.auditor@example.sg';
UPDATE platform.users SET name = 'Marcus Chia',   email = 'marcus.chia@mediacorp.com.sg' WHERE email = 'mediacorp.ops@example.sg';

-- ── Singtel ──────────────────────────────────────────────────────────────────
UPDATE platform.users SET name = 'Alex Sim',      email = 'alex.sim@singtel.com'         WHERE email = 'singtel.admin@example.sg';
UPDATE platform.users SET name = 'Priya Iyer',    email = 'priya.iyer@singtel.com'       WHERE email = 'singtel.risk@example.sg';
UPDATE platform.users SET name = 'Kenji Boo',     email = 'kenji.boo@singtel.com'        WHERE email = 'singtel.control@example.sg';
UPDATE platform.users SET name = 'Mei Ling Soh',  email = 'meilingsoh@singtel.com'       WHERE email = 'singtel.auditor@example.sg';
UPDATE platform.users SET name = 'Marcus Ong',    email = 'marcus.ong@singtel.com'       WHERE email = 'singtel.ops@example.sg';

\echo ' >> user names and emails updated to realistic Singapore professional identities'
