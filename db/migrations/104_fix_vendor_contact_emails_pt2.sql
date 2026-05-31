-- Migration 104: Replace synthetic contact48-89@vendor.example.com addresses
-- for vendors not covered by migration 098 (which covered contact1-47 only).
-- Maps each vendor to its real-world security/compliance contact address.

UPDATE vendor.vendors SET primary_contact_email = 'security@lacework.com'     WHERE primary_contact_email = 'contact48@vendor.example.com';
UPDATE vendor.vendors SET primary_contact_email = 'security@wiz.io'           WHERE primary_contact_email = 'contact49@vendor.example.com';
UPDATE vendor.vendors SET primary_contact_email = 'security@orca.security'    WHERE primary_contact_email = 'contact50@vendor.example.com';
UPDATE vendor.vendors SET primary_contact_email = 'security@sysdig.com'       WHERE primary_contact_email = 'contact51@vendor.example.com';
UPDATE vendor.vendors SET primary_contact_email = 'community@rapid7.com'      WHERE primary_contact_email = 'contact52@vendor.example.com';
UPDATE vendor.vendors SET primary_contact_email = 'compliance@tenable.com'    WHERE primary_contact_email = 'contact53@vendor.example.com';
UPDATE vendor.vendors SET primary_contact_email = 'compliance@qualys.com'     WHERE primary_contact_email = 'contact54@vendor.example.com';
UPDATE vendor.vendors SET primary_contact_email = 'security@hashicorp.com'    WHERE primary_contact_email = 'contact55@vendor.example.com';
UPDATE vendor.vendors SET primary_contact_email = 'security@cloudflare.com'   WHERE primary_contact_email = 'contact56@vendor.example.com';
UPDATE vendor.vendors SET primary_contact_email = 'compliance@akamai.com'     WHERE primary_contact_email = 'contact57@vendor.example.com';
UPDATE vendor.vendors SET primary_contact_email = 'security@fastly.com'       WHERE primary_contact_email = 'contact58@vendor.example.com';
UPDATE vendor.vendors SET primary_contact_email = 'compliance@imperva.com'    WHERE primary_contact_email = 'contact59@vendor.example.com';
UPDATE vendor.vendors SET primary_contact_email = 'f5sirt@f5.com'             WHERE primary_contact_email = 'contact60@vendor.example.com';
UPDATE vendor.vendors SET primary_contact_email = 'zsirt@zscaler.com'         WHERE primary_contact_email = 'contact61@vendor.example.com';
UPDATE vendor.vendors SET primary_contact_email = 'security@netskope.com'     WHERE primary_contact_email = 'contact62@vendor.example.com';
UPDATE vendor.vendors SET primary_contact_email = 'compliance@mimecast.com'   WHERE primary_contact_email = 'contact63@vendor.example.com';
UPDATE vendor.vendors SET primary_contact_email = 'security@proofpoint.com'   WHERE primary_contact_email = 'contact64@vendor.example.com';
UPDATE vendor.vendors SET primary_contact_email = 'compliance@knowbe4.com'    WHERE primary_contact_email = 'contact65@vendor.example.com';
UPDATE vendor.vendors SET primary_contact_email = 'security@anaplan.com'      WHERE primary_contact_email = 'contact66@vendor.example.com';
UPDATE vendor.vendors SET primary_contact_email = 'security@coupa.com'        WHERE primary_contact_email = 'contact67@vendor.example.com';
UPDATE vendor.vendors SET primary_contact_email = 'security@workiva.com'      WHERE primary_contact_email = 'contact68@vendor.example.com';
UPDATE vendor.vendors SET primary_contact_email = 'compliance@metricstream.com' WHERE primary_contact_email = 'contact69@vendor.example.com';
UPDATE vendor.vendors SET primary_contact_email = 'compliance@archerirm.com'  WHERE primary_contact_email = 'contact70@vendor.example.com';
UPDATE vendor.vendors SET primary_contact_email = 'psirt@us.ibm.com'          WHERE primary_contact_email = 'contact71@vendor.example.com';
UPDATE vendor.vendors SET primary_contact_email = 'compliance@solvfsl.com'    WHERE primary_contact_email = 'contact72@vendor.example.com';
UPDATE vendor.vendors SET primary_contact_email = 'security@nttdata.com'      WHERE primary_contact_email = 'contact73@vendor.example.com';
UPDATE vendor.vendors SET primary_contact_email = 'security@accenture.com'    WHERE primary_contact_email = 'contact74@vendor.example.com';
UPDATE vendor.vendors SET primary_contact_email = 'cybersecurity@deloitte.com' WHERE primary_contact_email = 'contact75@vendor.example.com';
UPDATE vendor.vendors SET primary_contact_email = 'cybersecurity@pwc.com'     WHERE primary_contact_email = 'contact76@vendor.example.com';
UPDATE vendor.vendors SET primary_contact_email = 'cybersecurity@kpmg.com'    WHERE primary_contact_email = 'contact77@vendor.example.com';
UPDATE vendor.vendors SET primary_contact_email = 'cybersecurity@ey.com'      WHERE primary_contact_email = 'contact78@vendor.example.com';
UPDATE vendor.vendors SET primary_contact_email = 'security@bain.com'         WHERE primary_contact_email = 'contact79@vendor.example.com';
UPDATE vendor.vendors SET primary_contact_email = 'security@bcg.com'          WHERE primary_contact_email = 'contact80@vendor.example.com';
UPDATE vendor.vendors SET primary_contact_email = 'security@mckinsey.com'     WHERE primary_contact_email = 'contact81@vendor.example.com';
UPDATE vendor.vendors SET primary_contact_email = 'compliance@capgemini.com'  WHERE primary_contact_email = 'contact82@vendor.example.com';
UPDATE vendor.vendors SET primary_contact_email = 'security@wipro.com'        WHERE primary_contact_email = 'contact83@vendor.example.com';
UPDATE vendor.vendors SET primary_contact_email = 'compliance@tcs.com'        WHERE primary_contact_email = 'contact84@vendor.example.com';
UPDATE vendor.vendors SET primary_contact_email = 'compliance@infosys.com'    WHERE primary_contact_email = 'contact85@vendor.example.com';
UPDATE vendor.vendors SET primary_contact_email = 'compliance@hcltech.com'    WHERE primary_contact_email = 'contact86@vendor.example.com';
UPDATE vendor.vendors SET primary_contact_email = 'security@cognizant.com'    WHERE primary_contact_email = 'contact87@vendor.example.com';
UPDATE vendor.vendors SET primary_contact_email = 'security@maersk.com'       WHERE primary_contact_email = 'contact88@vendor.example.com';
UPDATE vendor.vendors SET primary_contact_email = 'security@dhl.com'          WHERE primary_contact_email = 'contact89@vendor.example.com';

\echo ' >> 42 remaining vendor contact emails updated to real-world security/compliance addresses'
