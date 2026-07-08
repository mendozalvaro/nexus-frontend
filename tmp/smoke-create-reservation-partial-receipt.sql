select public.create_lodging_quick_checkin(
  p_organization_id := '1454d261-ff74-47b7-9b16-505783a68c77',
  p_branch_id := '27d583bf-1601-4d43-bb45-2caf22ca1e45',
  p_created_by := '62f8861e-e363-4aa6-865b-68680c77555b',
  p_check_in := '2026-07-10',
  p_check_out := '2026-07-11',
  p_is_open_ended := false,
  p_notes := 'Smoke reservation partial receipt rpc fix',
  p_rooms := '[
    {
      "roomId": "4b538d58-3d2c-4271-af7c-9d15da630284",
      "notes": "Smoke partial receipt",
      "guests": [
        {
          "fullName": "Huesped Smoke Recibo Parcial",
          "documentType": "CI",
          "documentNumber": "88776655",
          "birthDate": "1992-03-04",
          "sex": "female",
          "phone": "70000002",
          "email": "smoke.recibo.parcial@example.com",
          "nationality": "Bolivia",
          "address": "Zona Norte",
          "maritalStatus": "soltero",
          "isMainGuest": true
        }
      ]
    }
  ]'::jsonb,
  p_payment := '{
    "amount": 40,
    "paymentMethod": "cash",
    "paymentType": "deposit",
    "reference": "SMOKE-PARCIAL-RPC",
    "notes": "Pago parcial rpc"
  }'::jsonb
) as reservation_id;
