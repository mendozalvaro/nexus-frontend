-- Agregar modulo reports a todos los roles existentes en role_module_permissions
-- Admin: acceso completo a reports
INSERT INTO role_module_permissions (role_id, module_key, can_view, can_create, can_edit, can_delete, can_export, can_manage, created_at, updated_at)
SELECT ur.id, 'reports', true, true, true, true, true, true, now(), now()
FROM user_roles ur
WHERE ur.code = 'admin'
ON CONFLICT (role_id, module_key) DO UPDATE
SET can_view = true, can_create = true, can_edit = true, can_delete = true, can_export = true, can_manage = true, updated_at = now();

-- Manager: puede ver y exportar reportes
INSERT INTO role_module_permissions (role_id, module_key, can_view, can_create, can_edit, can_delete, can_export, can_manage, created_at, updated_at)
SELECT ur.id, 'reports', true, false, false, false, true, false, now(), now()
FROM user_roles ur
WHERE ur.code = 'manager'
ON CONFLICT (role_id, module_key) DO UPDATE
SET can_view = true, can_export = true, updated_at = now();

-- Employee: solo ver reportes basicos
INSERT INTO role_module_permissions (role_id, module_key, can_view, can_create, can_edit, can_delete, can_export, can_manage, created_at, updated_at)
SELECT ur.id, 'reports', true, false, false, false, false, false, now(), now()
FROM user_roles ur
WHERE ur.code = 'employee'
ON CONFLICT (role_id, module_key) DO UPDATE
SET can_view = true, updated_at = now();
