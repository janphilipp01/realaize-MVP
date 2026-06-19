-- Seed mock appointments for every org that currently has 0 appointments.
-- Safe to re-run.

DO $$
DECLARE
  v_org_id uuid;
BEGIN
  FOR v_org_id IN
    SELECT o.id FROM organizations o
    WHERE NOT EXISTS (SELECT 1 FROM appointments a WHERE a.org_id = o.id)
  LOOP
    RAISE NOTICE 'Seeding appointments for org %', v_org_id;

    INSERT INTO appointments (org_id, title, date, time, end_time, location, participants, category, notes) VALUES
      (v_org_id, 'Refinanzierungsgespräch – Hafenviertel Logistik', '2026-04-08', '10:00', '11:30', 'Berlin Hyp AG, Budapester Str. 1, Berlin', 'M. Wagner, Christine Zins (Berlin Hyp)', 'Finanzierung', 'DSCR-Breach besprechen. Neues Term Sheet für Refinanzierung erwarten.'),
      (v_org_id, 'IC-Meeting: Deal Prenzlauer Berg Revitalisierung', '2026-04-10', '09:00', '11:00', 'Büro Lestate Real, Schillstraße 5, Berlin', 'M. Wagner, S. Klein, Investitionskomitee', 'Kauf', 'Quartalspräsentation Baufortschritt. Kostenkontrolle: Budget vs. Actual.'),
      (v_org_id, 'Jahresgespräch Hauptmieter Westend Plaza', '2026-04-09', '11:00', '12:00', 'Bockenheimer Landstraße 47, Frankfurt', 'M. Wagner, Claudia Consulting (Consulting AG)', 'Verwaltung', 'Mietvertragsverlängerung besprechen (läuft 12/2027 aus).'),
      (v_org_id, 'Notar: Grundbucheintragung Schwabing Wohnpark', '2026-04-11', '14:30', '15:30', 'Notar Dr. Schwarzer, Maximilianstraße 18, München', 'M. Wagner', 'Verwaltung', 'Grundschuldänderung nach Teilrückführung.'),
      (v_org_id, 'Baugespräch Düsseldorf Gateway', '2026-04-14', '10:00', '12:00', 'Hinz & Partner Architekten, Düsseldorf', 'M. Wagner, Lukas Hinz', 'Bau', 'Planungsstand Baugenehmigung besprechen.');
  END LOOP;
END $$;
