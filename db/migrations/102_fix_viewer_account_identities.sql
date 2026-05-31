-- Migration 102: Replace "Viewer N <tenant>" names and @example.sg emails
-- for the 90 bulk viewer accounts (30 each for t_grab, t_maybank, t_mindef).
-- Assigns realistic Singapore professional names and org-domain addresses.

-- ── Grab Fintech APAC (30 viewers) ──────────────────────────────────────────
UPDATE platform.users SET name = 'Arun Krishnamurthy', email = 'arun.krishnamurthy@grab.com' WHERE email = 'viewer1.grab@example.sg';
UPDATE platform.users SET name = 'Belinda Seow',       email = 'belinda.seow@grab.com'        WHERE email = 'viewer2.grab@example.sg';
UPDATE platform.users SET name = 'Calvin Yeo',         email = 'calvin.yeo@grab.com'           WHERE email = 'viewer3.grab@example.sg';
UPDATE platform.users SET name = 'Diana Loh',          email = 'diana.loh@grab.com'            WHERE email = 'viewer4.grab@example.sg';
UPDATE platform.users SET name = 'Ethan Ng',           email = 'ethan.ng@grab.com'             WHERE email = 'viewer5.grab@example.sg';
UPDATE platform.users SET name = 'Fiona Tay',          email = 'fiona.tay@grab.com'            WHERE email = 'viewer6.grab@example.sg';
UPDATE platform.users SET name = 'Gary Tan',           email = 'gary.tan@grab.com'             WHERE email = 'viewer7.grab@example.sg';
UPDATE platform.users SET name = 'Hayley Ong',         email = 'hayley.ong@grab.com'           WHERE email = 'viewer8.grab@example.sg';
UPDATE platform.users SET name = 'Ivan Lim',           email = 'ivan.lim@grab.com'             WHERE email = 'viewer9.grab@example.sg';
UPDATE platform.users SET name = 'Jessica Wong',       email = 'jessica.wong@grab.com'         WHERE email = 'viewer10.grab@example.sg';
UPDATE platform.users SET name = 'Kevin Chan',         email = 'kevin.chan@grab.com'           WHERE email = 'viewer11.grab@example.sg';
UPDATE platform.users SET name = 'Lisa Kumar',         email = 'lisa.kumar@grab.com'           WHERE email = 'viewer12.grab@example.sg';
UPDATE platform.users SET name = 'Martin Chua',        email = 'martin.chua@grab.com'          WHERE email = 'viewer13.grab@example.sg';
UPDATE platform.users SET name = 'Natasha Rahman',     email = 'natasha.rahman@grab.com'       WHERE email = 'viewer14.grab@example.sg';
UPDATE platform.users SET name = 'Oscar Lee',          email = 'oscar.lee@grab.com'            WHERE email = 'viewer15.grab@example.sg';
UPDATE platform.users SET name = 'Patricia Soh',       email = 'patricia.soh@grab.com'         WHERE email = 'viewer16.grab@example.sg';
UPDATE platform.users SET name = 'Quentin Boo',        email = 'quentin.boo@grab.com'          WHERE email = 'viewer17.grab@example.sg';
UPDATE platform.users SET name = 'Rachel Ho',          email = 'rachel.ho@grab.com'            WHERE email = 'viewer18.grab@example.sg';
UPDATE platform.users SET name = 'Samuel Koh',         email = 'samuel.koh@grab.com'           WHERE email = 'viewer19.grab@example.sg';
UPDATE platform.users SET name = 'Teresa Poh',         email = 'teresa.poh@grab.com'           WHERE email = 'viewer20.grab@example.sg';
UPDATE platform.users SET name = 'Umar Hassan',        email = 'umar.hassan@grab.com'          WHERE email = 'viewer21.grab@example.sg';
UPDATE platform.users SET name = 'Vivian Foo',         email = 'vivian.foo@grab.com'           WHERE email = 'viewer22.grab@example.sg';
UPDATE platform.users SET name = 'Wayne Chong',        email = 'wayne.chong@grab.com'          WHERE email = 'viewer23.grab@example.sg';
UPDATE platform.users SET name = 'Xia Ming Wang',      email = 'xiaming.wang@grab.com'         WHERE email = 'viewer24.grab@example.sg';
UPDATE platform.users SET name = 'Yasmin Ismail',      email = 'yasmin.ismail@grab.com'        WHERE email = 'viewer25.grab@example.sg';
UPDATE platform.users SET name = 'Zachary Sim',        email = 'zachary.sim@grab.com'          WHERE email = 'viewer26.grab@example.sg';
UPDATE platform.users SET name = 'Adeline Goh',        email = 'adeline.goh@grab.com'          WHERE email = 'viewer27.grab@example.sg';
UPDATE platform.users SET name = 'Bernard Heng',       email = 'bernard.heng@grab.com'         WHERE email = 'viewer28.grab@example.sg';
UPDATE platform.users SET name = 'Celeste Bay',        email = 'celeste.bay@grab.com'          WHERE email = 'viewer29.grab@example.sg';
UPDATE platform.users SET name = 'Danny Phua',         email = 'danny.phua@grab.com'           WHERE email = 'viewer30.grab@example.sg';

-- ── Maybank Singapore (30 viewers) ──────────────────────────────────────────
UPDATE platform.users SET name = 'Aisha Binte Aziz',  email = 'aisha.aziz@maybank.com.sg'     WHERE email = 'viewer1.maybank@example.sg';
UPDATE platform.users SET name = 'Benjamin Tan',       email = 'benjamin.tan@maybank.com.sg'   WHERE email = 'viewer2.maybank@example.sg';
UPDATE platform.users SET name = 'Celine Lee',         email = 'celine.lee@maybank.com.sg'     WHERE email = 'viewer3.maybank@example.sg';
UPDATE platform.users SET name = 'Darren Wong',        email = 'darren.wong@maybank.com.sg'    WHERE email = 'viewer4.maybank@example.sg';
UPDATE platform.users SET name = 'Eleanor Lim',        email = 'eleanor.lim@maybank.com.sg'    WHERE email = 'viewer5.maybank@example.sg';
UPDATE platform.users SET name = 'Felix Ng',           email = 'felix.ng@maybank.com.sg'       WHERE email = 'viewer6.maybank@example.sg';
UPDATE platform.users SET name = 'Geraldine Chan',     email = 'geraldine.chan@maybank.com.sg'  WHERE email = 'viewer7.maybank@example.sg';
UPDATE platform.users SET name = 'Harold Teo',         email = 'harold.teo@maybank.com.sg'     WHERE email = 'viewer8.maybank@example.sg';
UPDATE platform.users SET name = 'Irene Ong',          email = 'irene.ong@maybank.com.sg'      WHERE email = 'viewer9.maybank@example.sg';
UPDATE platform.users SET name = 'Jason Ho',           email = 'jason.ho@maybank.com.sg'       WHERE email = 'viewer10.maybank@example.sg';
UPDATE platform.users SET name = 'Karen Soh',          email = 'karen.soh@maybank.com.sg'      WHERE email = 'viewer11.maybank@example.sg';
UPDATE platform.users SET name = 'Lawrence Koh',       email = 'lawrence.koh@maybank.com.sg'   WHERE email = 'viewer12.maybank@example.sg';
UPDATE platform.users SET name = 'Michelle Yap',       email = 'michelle.yap@maybank.com.sg'   WHERE email = 'viewer13.maybank@example.sg';
UPDATE platform.users SET name = 'Nicholas Sim',       email = 'nicholas.sim@maybank.com.sg'   WHERE email = 'viewer14.maybank@example.sg';
UPDATE platform.users SET name = 'Olivia Wee',         email = 'olivia.wee@maybank.com.sg'     WHERE email = 'viewer15.maybank@example.sg';
UPDATE platform.users SET name = 'Patrick Seah',       email = 'patrick.seah@maybank.com.sg'   WHERE email = 'viewer16.maybank@example.sg';
UPDATE platform.users SET name = 'Queenie Boo',        email = 'queenie.boo@maybank.com.sg'    WHERE email = 'viewer17.maybank@example.sg';
UPDATE platform.users SET name = 'Richard Phua',       email = 'richard.phua@maybank.com.sg'   WHERE email = 'viewer18.maybank@example.sg';
UPDATE platform.users SET name = 'Serena Ang',         email = 'serena.ang@maybank.com.sg'     WHERE email = 'viewer19.maybank@example.sg';
UPDATE platform.users SET name = 'Thomas Quek',        email = 'thomas.quek@maybank.com.sg'    WHERE email = 'viewer20.maybank@example.sg';
UPDATE platform.users SET name = 'Ursula Nair',        email = 'ursula.nair@maybank.com.sg'    WHERE email = 'viewer21.maybank@example.sg';
UPDATE platform.users SET name = 'Victor Chua',        email = 'victor.chua@maybank.com.sg'    WHERE email = 'viewer22.maybank@example.sg';
UPDATE platform.users SET name = 'Wendy Heng',         email = 'wendy.heng@maybank.com.sg'     WHERE email = 'viewer23.maybank@example.sg';
UPDATE platform.users SET name = 'Xavier Bay',         email = 'xavier.bay@maybank.com.sg'     WHERE email = 'viewer24.maybank@example.sg';
UPDATE platform.users SET name = 'Yvonne Foo',         email = 'yvonne.foo@maybank.com.sg'     WHERE email = 'viewer25.maybank@example.sg';
UPDATE platform.users SET name = 'Zainal Ibrahim',     email = 'zainal.ibrahim@maybank.com.sg' WHERE email = 'viewer26.maybank@example.sg';
UPDATE platform.users SET name = 'Angela Chen',        email = 'angela.chen@maybank.com.sg'    WHERE email = 'viewer27.maybank@example.sg';
UPDATE platform.users SET name = 'Brian Tay',          email = 'brian.tay@maybank.com.sg'      WHERE email = 'viewer28.maybank@example.sg';
UPDATE platform.users SET name = 'Cindy Goh',          email = 'cindy.goh@maybank.com.sg'      WHERE email = 'viewer29.maybank@example.sg';
UPDATE platform.users SET name = 'Daniel Yeo',         email = 'daniel.yeo@maybank.com.sg'     WHERE email = 'viewer30.maybank@example.sg';

-- ── MINDEF Defence Cloud (30 viewers) ───────────────────────────────────────
UPDATE platform.users SET name = 'CPT Aloysius Tan',  email = 'aloysius.tan@defence.gov.sg'   WHERE email = 'viewer1.mindef@example.sg';
UPDATE platform.users SET name = 'ME2 Brenda Lim',    email = 'brenda.lim@defence.gov.sg'     WHERE email = 'viewer2.mindef@example.sg';
UPDATE platform.users SET name = 'CPT Charles Wong',  email = 'charles.wong@defence.gov.sg'   WHERE email = 'viewer3.mindef@example.sg';
UPDATE platform.users SET name = 'CPT Denise Lee',    email = 'denise.lee@defence.gov.sg'     WHERE email = 'viewer4.mindef@example.sg';
UPDATE platform.users SET name = 'ME3 Edwin Ng',      email = 'edwin.ng@defence.gov.sg'       WHERE email = 'viewer5.mindef@example.sg';
UPDATE platform.users SET name = '2LT Florence Chan', email = 'florence.chan@defence.gov.sg'   WHERE email = 'viewer6.mindef@example.sg';
UPDATE platform.users SET name = 'CPT George Teo',    email = 'george.teo@defence.gov.sg'     WHERE email = 'viewer7.mindef@example.sg';
UPDATE platform.users SET name = 'ME2 Hannah Ong',    email = 'hannah.ong@defence.gov.sg'     WHERE email = 'viewer8.mindef@example.sg';
UPDATE platform.users SET name = 'CPT Isaac Loh',     email = 'isaac.loh@defence.gov.sg'      WHERE email = 'viewer9.mindef@example.sg';
UPDATE platform.users SET name = '2LT Jasmine Koh',   email = 'jasmine.koh@defence.gov.sg'    WHERE email = 'viewer10.mindef@example.sg';
UPDATE platform.users SET name = 'CPT Kenneth Sim',   email = 'kenneth.sim@defence.gov.sg'    WHERE email = 'viewer11.mindef@example.sg';
UPDATE platform.users SET name = 'ME3 Laura Ang',     email = 'laura.ang@defence.gov.sg'      WHERE email = 'viewer12.mindef@example.sg';
UPDATE platform.users SET name = 'CPT Matthew Phua',  email = 'matthew.phua@defence.gov.sg'   WHERE email = 'viewer13.mindef@example.sg';
UPDATE platform.users SET name = '2LT Natalie Ho',    email = 'natalie.ho@defence.gov.sg'     WHERE email = 'viewer14.mindef@example.sg';
UPDATE platform.users SET name = 'ME2 Omar Abdullah', email = 'omar.abdullah@defence.gov.sg'  WHERE email = 'viewer15.mindef@example.sg';
UPDATE platform.users SET name = 'CPT Priscilla Wee', email = 'priscilla.wee@defence.gov.sg'  WHERE email = 'viewer16.mindef@example.sg';
UPDATE platform.users SET name = 'CPT Rui Lin Quek',  email = 'ruilin.quek@defence.gov.sg'    WHERE email = 'viewer17.mindef@example.sg';
UPDATE platform.users SET name = 'ME3 Robert Yap',    email = 'robert.yap@defence.gov.sg'     WHERE email = 'viewer18.mindef@example.sg';
UPDATE platform.users SET name = '2LT Sandra Seah',   email = 'sandra.seah@defence.gov.sg'    WHERE email = 'viewer19.mindef@example.sg';
UPDATE platform.users SET name = 'CPT Timothy Bay',   email = 'timothy.bay@defence.gov.sg'    WHERE email = 'viewer20.mindef@example.sg';
UPDATE platform.users SET name = 'ME2 Uma Pillai',    email = 'uma.pillai@defence.gov.sg'     WHERE email = 'viewer21.mindef@example.sg';
UPDATE platform.users SET name = 'CPT Vince Chua',    email = 'vince.chua@defence.gov.sg'     WHERE email = 'viewer22.mindef@example.sg';
UPDATE platform.users SET name = '2LT Winnie Heng',   email = 'winnie.heng@defence.gov.sg'    WHERE email = 'viewer23.mindef@example.sg';
UPDATE platform.users SET name = 'ME3 Xavier Goh',    email = 'xavier.goh@defence.gov.sg'     WHERE email = 'viewer24.mindef@example.sg';
UPDATE platform.users SET name = 'CPT Yolanda Foo',   email = 'yolanda.foo@defence.gov.sg'    WHERE email = 'viewer25.mindef@example.sg';
UPDATE platform.users SET name = 'ME2 Zainuddin Hamid', email = 'zainuddin.hamid@defence.gov.sg' WHERE email = 'viewer26.mindef@example.sg';
UPDATE platform.users SET name = '2LT Adrian Tay',    email = 'adrian.tay@defence.gov.sg'     WHERE email = 'viewer27.mindef@example.sg';
UPDATE platform.users SET name = 'CPT Beatrice Chen', email = 'beatrice.chen@defence.gov.sg'  WHERE email = 'viewer28.mindef@example.sg';
UPDATE platform.users SET name = 'ME3 Colin Yeo',     email = 'colin.yeo@defence.gov.sg'      WHERE email = 'viewer29.mindef@example.sg';
UPDATE platform.users SET name = '2LT Dawn Quek',     email = 'dawn.quek@defence.gov.sg'      WHERE email = 'viewer30.mindef@example.sg';

\echo ' >> 90 viewer account identities updated with realistic Singapore professional names'
