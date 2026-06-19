#!/usr/bin/env node
/**
 * Seed mock contacts for every org that currently has 0 contacts.
 * Safe to re-run — skips orgs that already have contacts.
 *
 *   node scripts/seed-contacts.mjs
 */

import pg from "pg";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const MOCK_CONTACTS = [
  { category: "Handwerker", subcategory: "Rohbau", firstName: "Thomas", lastName: "Bauer", company: "Bauer Bau GmbH", position: "Geschäftsführer", email: "t.bauer@bauerbau.de", phone: "+49 30 1234567", city: "Berlin", tags: ["Zuverlässig", "Berlin"] },
  { category: "Handwerker", subcategory: "Rohbau", firstName: "Karl", lastName: "Meister", company: "Meister Rohbau AG", email: "k.meister@meister-rohbau.de", phone: "+49 30 9876543", city: "Berlin" },
  { category: "Handwerker", subcategory: "Elektro", firstName: "Max", lastName: "Volt", company: "ElektroMax GmbH", email: "m.volt@elektromax.de", phone: "+49 30 5551234", city: "Berlin" },
  { category: "Architekt & Planer", firstName: "Anna", lastName: "Braun", company: "Braun Architekten", position: "Partnerin", email: "a.braun@braun-arch.de", phone: "+49 30 2223344", city: "Berlin", website: "www.braun-architekten.de", tags: ["Wohnbau", "Denkmalschutz"] },
  { category: "Banker & Finanzierer", firstName: "Stefan", lastName: "Kredit", company: "Deutsche Pfandbriefbank", position: "Relationship Manager", email: "s.kredit@dpfb.de", phone: "+49 89 1112233", city: "München" },
  { category: "Makler", firstName: "Julia", lastName: "Immo", company: "JLL Deutschland", position: "Senior Broker", email: "j.immo@jll.de", phone: "+49 69 2223344", city: "Frankfurt" },
  { category: "Potentieller Käufer", firstName: "Klaus", lastName: "Bergmann", company: "Logistics RE Fund", email: "k.bergmann@logfund.de", phone: "+49 40 1234567", city: "Hamburg" },
  { category: "Mieter", firstName: "Hans", lastName: "Logistik", company: "LogisTrans GmbH", position: "Geschäftsführer", email: "h.logistik@logistrans.de", phone: "+49 40 9988776", city: "Hamburg" },
  { category: "Handwerker", subcategory: "Sanitär", firstName: "Peter", lastName: "Rohr", company: "Rohr & Sanitär GmbH", position: "Inhaber", email: "p.rohr@rohrsanitaer.de", phone: "+49 40 6665544", city: "Hamburg", tags: ["Hamburg", "Wohnbau"] },
  { category: "Handwerker", subcategory: "Trockenbau", firstName: "René", lastName: "Wand", company: "Wandsysteme Nordwest", email: "r.wand@wandsysteme-nw.de", phone: "+49 40 3332211", city: "Hamburg" },
  { category: "Architekt & Planer", firstName: "Lukas", lastName: "Hinz", company: "Hinz & Partner Architekten", position: "Geschäftsführer", email: "l.hinz@hinz-partner.de", phone: "+49 211 8889900", city: "Düsseldorf", website: "www.hinz-partner.de", tags: ["Bürobau", "DGNB", "NRW"] },
  { category: "Banker & Finanzierer", firstName: "Christine", lastName: "Zins", company: "Berlin Hyp AG", position: "Senior Relationship Manager", email: "c.zins@berlinhyp.de", phone: "+49 30 4443322", mobile: "+49 151 12345678", city: "Berlin", tags: ["Logistik", "Refinanzierung"] },
  { category: "Banker & Finanzierer", firstName: "Markus", lastName: "Bayern", company: "Bayerische Landesbank", position: "Direktor Real Estate Finance", email: "m.bayern@bayernlb.de", phone: "+49 89 2221100", city: "München" },
  { category: "Makler", firstName: "Robert", lastName: "Savills", company: "Savills Germany", position: "Director Capital Markets", email: "r.savills@savills.de", phone: "+49 69 9999888", city: "Frankfurt", tags: ["Büro", "Capital Markets"] },
  { category: "Makler", firstName: "Sandra", lastName: "CBRE", company: "CBRE Deutschland", position: "Associate Director", email: "s.cbre@cbre.de", phone: "+49 89 7778899", city: "München" },
  { category: "Property Manager", firstName: "Ingrid", lastName: "Haupt", company: "Haupt Immobilienverwaltung", position: "Objektleiterin", email: "i.haupt@haupt-iv.de", phone: "+49 69 6667788", city: "Frankfurt", tags: ["Westend", "Büro"] },
  { category: "Hausverwaltung", firstName: "Günter", lastName: "Schreib", company: "Schreib Hausverwaltung GmbH", position: "Geschäftsführer", email: "g.schreib@schreib-hv.de", phone: "+49 89 5556677", city: "München" },
  { category: "Mieter", firstName: "Claudia", lastName: "Consulting", company: "Consulting AG", position: "Leiterin Facility", email: "c.consulting@consulting-ag.de", phone: "+49 69 1113344", city: "Frankfurt" },
  { category: "Potentieller Investor", firstName: "Wolfgang", lastName: "Fonds", company: "Patrizia AG", position: "Fund Manager", email: "w.fonds@patrizia.ag", phone: "+49 821 5090100", city: "Augsburg", tags: ["Core", "Wohnen", "Büro"] },
  { category: "Potentieller Investor", firstName: "Monika", lastName: "Allianz", company: "Allianz Real Estate", position: "Investment Director", email: "m.allianz@allianz-re.de", phone: "+49 89 3800100", city: "München", tags: ["Institutional", "Büro", "Logistik"] },
  { category: "Stadtverwaltung", firstName: "Dr. Bernd", lastName: "Bauamt", company: "Stadtplanungsamt Düsseldorf", position: "Leiter Baurecht", email: "b.bauamt@duesseldorf.de", phone: "+49 211 8901234", city: "Düsseldorf" },
  { category: "Makler", firstName: "Tobias", lastName: "Engels", company: "Engel & Völkers Hamburg", position: "Senior Sales Advisor", email: "t.engels@engelvoelkers.de", phone: "+49 40 2244668", city: "Hamburg", tags: ["ETW", "Hamburg", "Altona"] },
];

async function run() {
  const client = await pool.connect();
  try {
    // Find orgs with 0 contacts
    const { rows: orgs } = await client.query(`
      SELECT o.id, o.name
      FROM organizations o
      WHERE NOT EXISTS (
        SELECT 1 FROM contacts c WHERE c.org_id = o.id
      )
    `);

    if (orgs.length === 0) {
      console.log("✓ Alle Orgs haben bereits Contacts — nichts zu tun.");
      return;
    }

    for (const org of orgs) {
      console.log(`Seeding ${MOCK_CONTACTS.length} contacts for org "${org.name}" (${org.id})…`);

      for (const c of MOCK_CONTACTS) {
        await client.query(
          `INSERT INTO contacts
             (org_id, category, subcategory, first_name, last_name, company, position,
              email, phone, mobile, city, website, tags)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
          [
            org.id,
            c.category,
            c.subcategory ?? null,
            c.firstName,
            c.lastName,
            c.company ?? null,
            c.position ?? null,
            c.email ?? null,
            c.phone ?? null,
            c.mobile ?? null,
            c.city ?? null,
            c.website ?? null,
            c.tags ? JSON.stringify(c.tags) : null,
          ]
        );
      }
      console.log(`  ✓ ${org.name} → ${MOCK_CONTACTS.length} contacts inserted`);
    }
    console.log("Done.");
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => { console.error(err); process.exit(1); });
