-- ============================================================================
-- NEXUS POS - SEED DATA PARA MODULO DE INVENTARIO
-- Organizacion: NexusPOS Demo (11111111-1111-4111-8111-111111111111)
-- ============================================================================

-- Productos adicionales para pruebas de movimientos
INSERT INTO products (id, organization_id, sku, name, description, cost_price, sale_price, category_id, track_inventory, is_active, created_at)
VALUES
  ('77777777-7777-4777-8777-777777777777', '11111111-1111-4111-8111-111111111111', 'SKU-GEL-007', 'Gel Styling Extra Hold', 'Gel fijador alta duracion', 22.00, 45.00, '41111111-1111-4111-8111-111111111111', true, true, now()),
  ('88888888-8888-4888-8888-888888888888', '11111111-1111-4111-8111-111111111111', 'SKU-SER-008', 'Serum Capilar Reparador', 'Serum reparador intensivo', 45.00, 89.00, '41111111-1111-4111-8111-111111111111', true, true, now()),
  ('99999999-9999-4999-9999-999999999999', '11111111-1111-4111-8111-111111111111', 'SKU-CER-009', 'Cera Matte Finish', 'Cera acabado mate natural', 28.00, 55.00, '41111111-1111-4111-8111-111111111111', true, true, now())
ON CONFLICT (id) DO NOTHING;

-- Stock inicial para productos nuevos en Sucursal Central
INSERT INTO inventory_stock (branch_id, product_id, quantity, min_stock_level, reserved_quantity, updated_at)
VALUES
  ('21111111-1111-4111-8111-111111111111', '77777777-7777-4777-8777-777777777777', 15, 5, 0, now()),
  ('21111111-1111-4111-8111-111111111111', '88888888-8888-4888-8888-888888888888', 8, 3, 0, now()),
  ('21111111-1111-4111-8111-111111111111', '99999999-9999-4999-9999-999999999999', 20, 8, 0, now()),
  -- Stock en Sucursal Norte
  ('22222222-2222-4222-8222-222222222222', '77777777-7777-4777-8777-777777777777', 12, 5, 0, now()),
  ('22222222-2222-4222-8222-222222222222', '88888888-8888-4888-8888-888888888888', 4, 3, 0, now()),
  ('22222222-2222-4222-8222-222222222222', '99999999-9999-4999-9999-999999999999', 6, 8, 0, now()),
  -- Stock en Sucursal Sur
  ('23333333-3333-4333-8333-333333333333', '77777777-7777-4777-8777-777777777777', 3, 5, 0, now()),
  ('23333333-3333-4333-8333-333333333333', '88888888-8888-4888-8888-888888888888', 10, 3, 0, now()),
  ('23333333-3333-4333-8333-333333333333', '99999999-9999-4999-9999-999999999999', 14, 8, 0, now())
ON CONFLICT (branch_id, product_id) DO NOTHING;

-- Movimientos de prueba recientes (tipos validos: entry, exit, adjustment, transfer_in, transfer_out)
INSERT INTO inventory_movements (id, organization_id, branch_id, product_id, movement_type, quantity, previous_quantity, new_quantity, reason, created_by, created_at)
VALUES
  (gen_random_uuid(), '11111111-1111-4111-8111-111111111111', '21111111-1111-4111-8111-111111111111', '61111111-1111-4111-8111-111111111111', 'entry', 5, 20, 25, 'Entrada de mercancia semanal', '31111111-1111-4111-8111-111111111111', now() - interval '2 days'),
  (gen_random_uuid(), '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', '65555555-5555-4555-8555-555555555555', 'exit', 2, 11, 9, 'Venta del dia', '32222222-2222-4222-8222-222222222222', now() - interval '1 day'),
  (gen_random_uuid(), '11111111-1111-4111-8111-111111111111', '23333333-3333-4333-8333-333333333333', '66666666-6666-4666-8666-666666666666', 'adjustment', 3, 6, 9, 'Ajuste de inventario periodico', '31111111-1111-4111-8111-111111111111', now() - interval '3 days')
ON CONFLICT DO NOTHING;

-- Batch de ajuste de prueba
INSERT INTO inventory_adjust_batches (id, organization_id, branch_id, mode, reason, note, total_lines, processed_count, processed_by, idempotency_key, created_at, updated_at)
VALUES
  (gen_random_uuid(), '11111111-1111-4111-8111-111111111111', '21111111-1111-4111-8111-111111111111', 'add', 'Recepcion de pedido #1234', 'Proveedor: Distribuidora BeautyCorp', 3, 3, '31111111-1111-4111-8111-111111111111', 'SEED-BATCH-001', now() - interval '1 week', now())
ON CONFLICT DO NOTHING;
