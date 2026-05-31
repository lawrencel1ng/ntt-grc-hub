-- Migration 043: Replace placeholder JSONB in esg.disclosures with
-- framework-appropriate content metrics. Idempotent: WHERE on exact old value.

UPDATE esg.disclosures
SET content = CASE framework
  WHEN 'CSRD' THEN jsonb_build_object(
    'summary', 'Annual Corporate Sustainability Reporting Directive disclosure',
    'reporting_period', period,
    'sections', 14,
    'material_topics', jsonb_build_array(
      'Climate change mitigation', 'Climate change adaptation',
      'Water and marine resources', 'Biodiversity',
      'Circular economy', 'Own workforce', 'Supply chain workers',
      'Affected communities', 'Consumers and end-users',
      'Business conduct', 'Governance of sustainability matters',
      'Strategy and business model', 'Risk management', 'Targets and progress'
    ),
    'assurance_level', 'limited',
    'scope_1_tco2e', (CASE tenant_id
      WHEN 't_maybank' THEN 4820
      WHEN 't_grab' THEN 2310
      ELSE 890 END),
    'scope_2_tco2e', (CASE tenant_id
      WHEN 't_maybank' THEN 12400
      WHEN 't_grab' THEN 7800
      ELSE 3200 END),
    'scope_3_included', true,
    'female_leadership_pct', (CASE tenant_id
      WHEN 't_maybank' THEN 38
      WHEN 't_grab' THEN 44
      ELSE 29 END),
    'pay_gap_pct', (CASE tenant_id
      WHEN 't_maybank' THEN 5.2
      WHEN 't_grab' THEN 3.8
      ELSE 7.1 END)
  )
  WHEN 'ISSB' THEN jsonb_build_object(
    'summary', 'IFRS S1 and S2 sustainability-related financial disclosures',
    'reporting_period', period,
    'sections', 9,
    'standards_applied', jsonb_build_array('IFRS S1 General Requirements', 'IFRS S2 Climate-related Disclosures'),
    'assurance_level', 'limited',
    'climate_scenario_analysis', true,
    'scenarios_used', jsonb_build_array('IEA NZE 2050', 'NGFS Current Policies', 'NGFS Delayed Transition'),
    'physical_risk_high_exposure_assets_pct', (CASE tenant_id
      WHEN 't_maybank' THEN 12
      WHEN 't_grab' THEN 8
      ELSE 6 END),
    'transition_risk_stranded_asset_exposure_sgd_m', (CASE tenant_id
      WHEN 't_maybank' THEN 340
      WHEN 't_grab' THEN 180
      ELSE 95 END),
    'financed_emissions_tco2e_b', (CASE tenant_id
      WHEN 't_maybank' THEN 2.4
      WHEN 't_grab' THEN 0.9
      ELSE 0.3 END)
  )
  WHEN 'GHG' THEN jsonb_build_object(
    'summary', 'GHG Protocol Corporate Standard emissions inventory',
    'reporting_period', period,
    'sections', 6,
    'protocol_version', 'GHG Protocol Corporate Standard (2015 rev)',
    'base_year', 2022,
    'scope_1_tco2e', (CASE tenant_id
      WHEN 't_maybank' THEN 4820
      WHEN 't_grab' THEN 2310
      ELSE 890 END),
    'scope_2_market_based_tco2e', (CASE tenant_id
      WHEN 't_maybank' THEN 8200
      WHEN 't_grab' THEN 5400
      ELSE 2100 END),
    'scope_2_location_based_tco2e', (CASE tenant_id
      WHEN 't_maybank' THEN 12400
      WHEN 't_grab' THEN 7800
      ELSE 3200 END),
    'scope_3_categories_included', jsonb_build_array(1, 3, 6, 7, 11, 15),
    'scope_3_tco2e', (CASE tenant_id
      WHEN 't_maybank' THEN 285000
      WHEN 't_grab' THEN 94000
      ELSE 38000 END),
    'intensity_tco2e_per_sgd_m_revenue', (CASE tenant_id
      WHEN 't_maybank' THEN 4.2
      WHEN 't_grab' THEN 3.8
      ELSE 5.1 END),
    'verified_by', 'SGS Singapore Pte Ltd',
    'verification_standard', 'ISO 14064-3'
  )
  WHEN 'TCFD' THEN jsonb_build_object(
    'summary', 'Task Force on Climate-related Financial Disclosures report',
    'reporting_period', period,
    'sections', 11,
    'pillars', jsonb_build_array('Governance', 'Strategy', 'Risk Management', 'Metrics and Targets'),
    'board_oversight_mechanism', 'Board Risk Committee — quarterly climate risk review',
    'management_role', 'CRO owns Climate Risk Framework; annual board escalation',
    'scenario_horizons', jsonb_build_array('2030 (short)', '2040 (medium)', '2050 (long)'),
    'net_zero_target_year', 2050,
    'interim_target_pct_reduction_2030', (CASE tenant_id
      WHEN 't_maybank' THEN 45
      WHEN 't_grab' THEN 50
      ELSE 40 END),
    'renewable_energy_pct', (CASE tenant_id
      WHEN 't_maybank' THEN 28
      WHEN 't_grab' THEN 41
      ELSE 19 END),
    'data_centre_pue', (CASE tenant_id
      WHEN 't_maybank' THEN 1.42
      WHEN 't_grab' THEN 1.38
      ELSE 1.51 END)
  )
  ELSE content
END
WHERE content = '{"summary": "Annual disclosure", "sections": 12}'::jsonb;
