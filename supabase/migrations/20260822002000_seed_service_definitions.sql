insert into public.organizations (id, name, short_name, destination_text)
values
  (
    '00000000-0000-4000-8000-000000000001',
    'University of Johannesburg Finance Office',
    'UJ Finance',
    'University of Johannesburg Finance Office — External Bursary Allowances'
  ),
  (
    '00000000-0000-4000-8000-000000000002',
    'Demo Motor Vehicle Registering Authority',
    'Vehicle Authority',
    'Selected Motor Vehicle Registering Authority or participating Post Office'
  )
on conflict (id) do update set
  name = excluded.name,
  short_name = excluded.short_name,
  destination_text = excluded.destination_text;

insert into public.document_types (
  id,
  label,
  default_expiry_method,
  default_duration_months,
  requires_year,
  allows_signed_attestation
)
values
  ('certified_id_copy', 'Recent certified ID copy', 'duration', 3, false, false),
  ('identity_document', 'Identity document', 'none', null, false, false),
  ('proof_academic_registration', 'Proof of Academic Registration', 'duration', 3, true, false),
  ('bursary_confirmation_letter', 'Bursary confirmation letter', 'duration', 3, true, false),
  ('external_bursary_allowance_form', 'Signed external bursary allowance form', 'duration', 3, true, true),
  ('bank_confirmation_letter', 'Bank confirmation letter', 'duration', 3, false, false),
  ('proof_residential_address', 'Proof of residential address', 'duration', 3, false, false),
  ('vehicle_licence_alv_form', 'Completed ALV form', 'duration', 3, false, true)
on conflict (id) do update set
  label = excluded.label,
  default_expiry_method = excluded.default_expiry_method,
  default_duration_months = excluded.default_duration_months,
  requires_year = excluded.requires_year,
  allows_signed_attestation = excluded.allows_signed_attestation;

insert into public.services (
  id,
  organization_id,
  name,
  description,
  destination_text,
  blank_form_path,
  active
)
values
  (
    'uj_external_bursary_allowance_2026',
    '00000000-0000-4000-8000-000000000001',
    'UJ External Bursary Allowance Claim',
    'Prepare the five documents needed for a 2026 external-bursary allowance claim.',
    'University of Johannesburg Finance Office — External Bursary Allowances',
    '/forms/external-bursary-allowance-form-2026.pdf',
    true
  ),
  (
    'motor_vehicle_licence_disc_renewal',
    '00000000-0000-4000-8000-000000000002',
    'Motor Vehicle Licence Disc Renewal',
    'Prepare the three documents included in the MVP vehicle-licence renewal journey.',
    'Selected Motor Vehicle Registering Authority or participating Post Office',
    '/forms/vehiclelicenserenewalform.pdf',
    true
  )
on conflict (id) do update set
  organization_id = excluded.organization_id,
  name = excluded.name,
  description = excluded.description,
  destination_text = excluded.destination_text,
  blank_form_path = excluded.blank_form_path,
  active = excluded.active;

insert into public.service_requirements (
  id,
  service_id,
  document_type_id,
  label,
  sort_order,
  freshness_months,
  required_reference_year,
  requires_signed_attestation,
  allows_no_expiry,
  help_text
)
values
  (
    '10000000-0000-4000-8000-000000000001',
    'uj_external_bursary_allowance_2026',
    'certified_id_copy',
    'Recent certified ID copy',
    1, 3, null, false, false,
    'Upload a copy certified within the last three calendar months.'
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    'uj_external_bursary_allowance_2026',
    'proof_academic_registration',
    'Proof of Academic Registration',
    2, 3, 2026, false, false,
    'Upload proof for the 2026 academic year issued within the last three calendar months.'
  ),
  (
    '10000000-0000-4000-8000-000000000003',
    'uj_external_bursary_allowance_2026',
    'bursary_confirmation_letter',
    'Bursary confirmation letter',
    3, 3, 2026, false, false,
    'Upload a 2026 bursary letter issued within the last three calendar months.'
  ),
  (
    '10000000-0000-4000-8000-000000000004',
    'uj_external_bursary_allowance_2026',
    'external_bursary_allowance_form',
    'Signed external bursary allowance form',
    4, 3, 2026, true, false,
    'Download the 2026 form, complete and sign it, then upload the signed copy.'
  ),
  (
    '10000000-0000-4000-8000-000000000005',
    'uj_external_bursary_allowance_2026',
    'bank_confirmation_letter',
    'Bank confirmation letter',
    5, 3, null, false, false,
    'Upload a bank confirmation letter issued within the last three calendar months.'
  ),
  (
    '20000000-0000-4000-8000-000000000001',
    'motor_vehicle_licence_disc_renewal',
    'identity_document',
    'Identity document',
    1, null, null, false, true,
    'Upload a current identity document. Record its fixed expiry date when supplied, otherwise select no expiry.'
  ),
  (
    '20000000-0000-4000-8000-000000000002',
    'motor_vehicle_licence_disc_renewal',
    'proof_residential_address',
    'Proof of residential address',
    2, 3, null, false, false,
    'Upload proof of address issued within the last three calendar months.'
  ),
  (
    '20000000-0000-4000-8000-000000000003',
    'motor_vehicle_licence_disc_renewal',
    'vehicle_licence_alv_form',
    'Completed ALV form',
    3, 3, null, true, false,
    'Download the ALV form, complete and sign it, then upload the completed copy.'
  )
on conflict (id) do update set
  service_id = excluded.service_id,
  document_type_id = excluded.document_type_id,
  label = excluded.label,
  sort_order = excluded.sort_order,
  freshness_months = excluded.freshness_months,
  required_reference_year = excluded.required_reference_year,
  requires_signed_attestation = excluded.requires_signed_attestation,
  allows_no_expiry = excluded.allows_no_expiry,
  help_text = excluded.help_text;
