-- Seed the two default acquisition profiles for every org that has none yet.
-- Düsseldorf Value-Add + Düsseldorf Core+ · €0.5–5 M / 100–1,500 m² sweet spot.
-- Safe to re-run.

DO $$
DECLARE
  v_org_id uuid;
BEGIN
  FOR v_org_id IN
    SELECT o.id FROM organizations o
    WHERE NOT EXISTS (SELECT 1 FROM acquisition_profiles p WHERE p.org_id = o.id)
  LOOP
    RAISE NOTICE 'Seeding acquisition profiles for org %', v_org_id;

    INSERT INTO acquisition_profiles
      (org_id, name, screening_mode, cities, submarkets, asset_classes,
       price_min, price_max, area_min, area_max,
       min_discount_price_pct, min_discount_factor_pct, min_gross_yield_pct, active)
    VALUES
      (v_org_id, 'Düsseldorf Value-Add Residential', 'discount_to_market',
       ARRAY['Düsseldorf','Meerbusch','Ratingen','Neuss','Hilden','Erkrath'],
       ARRAY[]::text[], ARRAY['residential','mixed_use'],
       500000, 5000000, 100, 1500,
       10, 5, NULL, true),
      (v_org_id, 'Düsseldorf Core+ Residential', 'absolute_yield_threshold',
       ARRAY['Düsseldorf','Meerbusch','Ratingen','Neuss','Hilden','Erkrath'],
       ARRAY[]::text[], ARRAY['residential','mixed_use'],
       500000, 5000000, 100, 1500,
       0, NULL, 5.0, true);
  END LOOP;
END $$;
