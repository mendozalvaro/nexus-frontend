# 🔒 Reglas de Seguridad - NO NEGOCIABLES

## 🚫 NUNCA hacer esto (Violaciones Críticas)

1. NO generar código que bypass RLS de Supabase
2. NO almacenar secrets (.env) en el código frontend
3. NO validar permisos solo en frontend (siempre validar en DB)
4. NO exponer `service_role_key` de Supabase en el cliente
5. NO permitir queries sin filtro `organization_id` para datos tenant
6. NO usar `any` en TypeScript para tipos de datos sensibles
7. NO loguear passwords o tokens en console.log
8. NO permitir SQL injection (usar siempre queries parametrizadas)

## ✅ SIEMPRE hacer esto (Obligatorio)

1. USAR `useSupabaseClient()` con el cliente anon (nunca service_role)
2. VALIDAR roles con `get_user_role()` desde la DB
3. FILTRAR por `organization_id` en todas las queries de datos
4. USAR el composable `useSubscription()` para verificar límites antes de mostrar UI
5. LOGUEAR acciones críticas para auditoría forense
6. USAR `useAsyncData` o `useFetch` para server-side fetching
7. INCLUIR estados de carga, error y vacío en todos los componentes
8. SANITIZAR todos los inputs de usuario antes de enviar a DB

## Autenticación

```typescript
// ✅ CORRECTO - Usar composables del módulo
const supabase = useSupabaseClient();
const { session, user } = useSupabaseSession();

// Login
const { error } = await supabase.auth.signInWithPassword({
  email,
  password,
});

// Logout
await supabase.auth.signOut();

// ❌ INCORRECTO - No crear cliente manualmente en frontend
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY); // NUNCA
```

## Queries Multi-Tenancy

```typescript
// ✅ CORRECTO
const { data } = await supabase
  .from("transactions")
  .select("*")
  .eq("organization_id", orgId)
  .eq("branch_id", branchId);

// ❌ INCORRECTO (sin filtro org - VIOLACIÓN DE SEGURIDAD)
const { data } = await supabase.from("transactions").select("*");
```

## Manejo de Errores Seguro

```typescript
// ✅ CORRECTO
try {
  const { data, error } = await supabase.from("...").select();
  if (error) {
    console.error("Database error:", error.message);
    throw new Error("No se pudo cargar la información");
  }
  return data;
} catch (err) {
  // No exponer detalles internos al usuario final
  return null;
}
```
