select public.create_lodging_quick_checkin(
  p_organization_id := '1454d261-ff74-47b7-9b16-505783a68c77',
  p_branch_id := '27d583bf-1601-4d43-bb45-2caf22ca1e45',
  p_created_by := '62f8861e-e363-4aa6-865b-68680c77555b',
  p_check_in := '2026-07-08',
  p_check_out := '2026-07-09',
  p_is_open_ended := false,
  p_notes := 'Smoke reservation partial-full-checkin',
  p_rooms := '[
    {
      "roomId": "f14dd784-9455-4835-8565-b7e805f0f041",
      "notes": "Smoke partial payment",
      "guests": [
        {
          "fullName": "Huesped Smoke Pago",
          "documentType": "CI",
          "documentNumber": "99887766",
          "birthDate": "1993-05-10",
          "sex": "male",
          "phone": "70000001",
          "email": "smoke.pago@example.com",
          "nationality": "Bolivia",
          "address": "Zona Centro",
          "maritalStatus": "soltero",
          "isMainGuest": true
        }
      ]
    }
  ]'::jsonb,
  p_payment := '{
    "amount": 50,
    "paymentMethod": "cash",
    "paymentType": "deposit",
    "reference": "SMOKE-PARCIAL",
    "notes": "Pago parcial smoke"
  }'::jsonb
) as reservation_id;
