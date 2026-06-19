-- Seed mock contacts for every org that currently has 0 contacts.
-- Safe to re-run (INSERT ... WHERE NOT EXISTS guard per org).

DO $$
DECLARE
  v_org_id uuid;
BEGIN
  FOR v_org_id IN
    SELECT o.id FROM organizations o
    WHERE NOT EXISTS (SELECT 1 FROM contacts c WHERE c.org_id = o.id)
  LOOP
    RAISE NOTICE 'Seeding contacts for org %', v_org_id;

    INSERT INTO contacts (org_id, category, subcategory, first_name, last_name, company, position, email, phone, mobile, city, website, tags) VALUES
      (v_org_id, 'Handwerker', 'Rohbau', 'Thomas', 'Bauer', 'Bauer Bau GmbH', 'Geschäftsführer', 't.bauer@bauerbau.de', '+49 30 1234567', NULL, 'Berlin', NULL, '["Zuverlässig","Berlin"]'),
      (v_org_id, 'Handwerker', 'Rohbau', 'Karl', 'Meister', 'Meister Rohbau AG', NULL, 'k.meister@meister-rohbau.de', '+49 30 9876543', NULL, 'Berlin', NULL, NULL),
      (v_org_id, 'Handwerker', 'Elektro', 'Max', 'Volt', 'ElektroMax GmbH', NULL, 'm.volt@elektromax.de', '+49 30 5551234', NULL, 'Berlin', NULL, NULL),
      (v_org_id, 'Architekt & Planer', NULL, 'Anna', 'Braun', 'Braun Architekten', 'Partnerin', 'a.braun@braun-arch.de', '+49 30 2223344', NULL, 'Berlin', 'www.braun-architekten.de', '["Wohnbau","Denkmalschutz"]'),
      (v_org_id, 'Banker & Finanzierer', NULL, 'Stefan', 'Kredit', 'Deutsche Pfandbriefbank', 'Relationship Manager', 's.kredit@dpfb.de', '+49 89 1112233', NULL, 'München', NULL, NULL),
      (v_org_id, 'Makler', NULL, 'Julia', 'Immo', 'JLL Deutschland', 'Senior Broker', 'j.immo@jll.de', '+49 69 2223344', NULL, 'Frankfurt', NULL, NULL),
      (v_org_id, 'Potentieller Käufer', NULL, 'Klaus', 'Bergmann', 'Logistics RE Fund', NULL, 'k.bergmann@logfund.de', '+49 40 1234567', NULL, 'Hamburg', NULL, NULL),
      (v_org_id, 'Mieter', NULL, 'Hans', 'Logistik', 'LogisTrans GmbH', 'Geschäftsführer', 'h.logistik@logistrans.de', '+49 40 9988776', NULL, 'Hamburg', NULL, NULL),
      (v_org_id, 'Handwerker', 'Sanitär', 'Peter', 'Rohr', 'Rohr & Sanitär GmbH', 'Inhaber', 'p.rohr@rohrsanitaer.de', '+49 40 6665544', NULL, 'Hamburg', NULL, '["Hamburg","Wohnbau"]'),
      (v_org_id, 'Handwerker', 'Trockenbau', 'René', 'Wand', 'Wandsysteme Nordwest', NULL, 'r.wand@wandsysteme-nw.de', '+49 40 3332211', NULL, 'Hamburg', NULL, NULL),
      (v_org_id, 'Architekt & Planer', NULL, 'Lukas', 'Hinz', 'Hinz & Partner Architekten', 'Geschäftsführer', 'l.hinz@hinz-partner.de', '+49 211 8889900', NULL, 'Düsseldorf', 'www.hinz-partner.de', '["Bürobau","DGNB","NRW"]'),
      (v_org_id, 'Banker & Finanzierer', NULL, 'Christine', 'Zins', 'Berlin Hyp AG', 'Senior Relationship Manager', 'c.zins@berlinhyp.de', '+49 30 4443322', '+49 151 12345678', 'Berlin', NULL, '["Logistik","Refinanzierung"]'),
      (v_org_id, 'Banker & Finanzierer', NULL, 'Markus', 'Bayern', 'Bayerische Landesbank', 'Direktor Real Estate Finance', 'm.bayern@bayernlb.de', '+49 89 2221100', NULL, 'München', NULL, NULL),
      (v_org_id, 'Makler', NULL, 'Robert', 'Savills', 'Savills Germany', 'Director Capital Markets', 'r.savills@savills.de', '+49 69 9999888', NULL, 'Frankfurt', NULL, '["Büro","Capital Markets"]'),
      (v_org_id, 'Makler', NULL, 'Sandra', 'CBRE', 'CBRE Deutschland', 'Associate Director', 's.cbre@cbre.de', '+49 89 7778899', NULL, 'München', NULL, NULL),
      (v_org_id, 'Property Manager', NULL, 'Ingrid', 'Haupt', 'Haupt Immobilienverwaltung', 'Objektleiterin', 'i.haupt@haupt-iv.de', '+49 69 6667788', NULL, 'Frankfurt', NULL, '["Westend","Büro"]'),
      (v_org_id, 'Hausverwaltung', NULL, 'Günter', 'Schreib', 'Schreib Hausverwaltung GmbH', 'Geschäftsführer', 'g.schreib@schreib-hv.de', '+49 89 5556677', NULL, 'München', NULL, NULL),
      (v_org_id, 'Mieter', NULL, 'Claudia', 'Consulting', 'Consulting AG', 'Leiterin Facility', 'c.consulting@consulting-ag.de', '+49 69 1113344', NULL, 'Frankfurt', NULL, NULL),
      (v_org_id, 'Potentieller Investor', NULL, 'Wolfgang', 'Fonds', 'Patrizia AG', 'Fund Manager', 'w.fonds@patrizia.ag', '+49 821 5090100', NULL, 'Augsburg', NULL, '["Core","Wohnen","Büro"]'),
      (v_org_id, 'Potentieller Investor', NULL, 'Monika', 'Allianz', 'Allianz Real Estate', 'Investment Director', 'm.allianz@allianz-re.de', '+49 89 3800100', NULL, 'München', NULL, '["Institutional","Büro","Logistik"]'),
      (v_org_id, 'Stadtverwaltung', NULL, 'Dr. Bernd', 'Bauamt', 'Stadtplanungsamt Düsseldorf', 'Leiter Baurecht', 'b.bauamt@duesseldorf.de', '+49 211 8901234', NULL, 'Düsseldorf', NULL, NULL),
      (v_org_id, 'Makler', NULL, 'Tobias', 'Engels', 'Engel & Völkers Hamburg', 'Senior Sales Advisor', 't.engels@engelvoelkers.de', '+49 40 2244668', NULL, 'Hamburg', NULL, '["ETW","Hamburg","Altona"]');

  END LOOP;
END $$;
