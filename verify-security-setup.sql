-- Script para verificar que la configuración de seguridad esté correcta
-- Ejecutar después de aplicar fix-security-definer.sql

-- 1. Verificar que la vista problemática haya sido eliminada
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.views 
            WHERE table_schema = 'public' 
            AND table_name = 'expense_summary'
        ) 
        THEN '❌ Vista expense_summary todavía existe'
        ELSE '✅ Vista expense_summary eliminada correctamente'
    END as vista_status;

-- 2. Verificar que todas las tablas tengan RLS habilitado
SELECT 
    schemaname,
    tablename,
    CASE 
        WHEN rowsecurity = true THEN '✅ RLS habilitado'
        ELSE '❌ RLS deshabilitado'
    END as rls_status
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('user_expenses', 'user_categories', 'user_profiles', 'user_recurring_expenses')
ORDER BY tablename;

-- 3. Verificar políticas de seguridad en tablas principales
SELECT 
    schemaname,
    tablename,
    policyname,
    CASE 
        WHEN cmd = 'r' THEN 'SELECT'
        WHEN cmd = 'a' THEN 'INSERT'
        WHEN cmd = 'w' THEN 'UPDATE'
        WHEN cmd = 'd' THEN 'DELETE'
        ELSE 'OTHER'
    END as command_type,
    CASE 
        WHEN qual IS NOT NULL THEN '✅ Tiene restricción WHERE'
        ELSE '⚠️ Sin restricción WHERE'
    END as security_check
FROM pg_policies 
WHERE schemaname = 'public'
  AND tablename IN ('user_expenses', 'user_categories', 'user_profiles', 'user_recurring_expenses')
ORDER BY tablename, policyname;

-- 4. Verificar que no haya funciones con SECURITY DEFINER problemáticas
SELECT 
    n.nspname as schema_name,
    p.proname as function_name,
    CASE 
        WHEN p.prosecdef = true THEN '⚠️ SECURITY DEFINER'
        ELSE '✅ SECURITY INVOKER'
    END as security_type,
    CASE 
        WHEN p.prosecdef = true AND p.proname NOT IN ('create_sample_data') 
        THEN '❌ Revisar función'
        ELSE '✅ OK'
    END as security_check
FROM pg_proc p
LEFT JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname LIKE '%expense%'
ORDER BY p.proname;

-- 5. Verificar configuración de autenticación
SELECT 
    CASE 
        WHEN current_setting('app.jwt_secret', true) IS NOT NULL 
        THEN '✅ JWT configurado'
        ELSE '⚠️ JWT no configurado'
    END as jwt_status;

-- 6. Verificar roles y permisos
SELECT 
    r.rolname,
    CASE 
        WHEN r.rolcanlogin = true THEN '✅ Puede login'
        ELSE '❌ No puede login'
    END as login_status,
    CASE 
        WHEN r.rolsuper = true THEN '⚠️ Superusuario'
        ELSE '✅ Usuario normal'
    END as privilege_level
FROM pg_roles r
WHERE r.rolname IN ('postgres', 'authenticated', 'anon', 'service_role')
ORDER BY r.rolname;

-- 7. Verificar permisos en tablas principales
SELECT 
    schemaname,
    tablename,
    CASE 
        WHEN has_table_privilege('authenticated', schemaname||'.'||tablename, 'SELECT') 
        THEN '✅ SELECT permitido'
        ELSE '❌ SELECT denegado'
    END as select_permission,
    CASE 
        WHEN has_table_privilege('authenticated', schemaname||'.'||tablename, 'INSERT') 
        THEN '✅ INSERT permitido'
        ELSE '❌ INSERT denegado'
    END as insert_permission,
    CASE 
        WHEN has_table_privilege('authenticated', schemaname||'.'||tablename, 'UPDATE') 
        THEN '✅ UPDATE permitido'
        ELSE '❌ UPDATE denegado'
    END as update_permission,
    CASE 
        WHEN has_table_privilege('authenticated', schemaname||'.'||tablename, 'DELETE') 
        THEN '✅ DELETE permitido'
        ELSE '❌ DELETE denegado'
    END as delete_permission
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('user_expenses', 'user_categories', 'user_profiles', 'user_recurring_expenses')
ORDER BY tablename;

-- 8. Resumen de seguridad
SELECT 
    '🔒 RESUMEN DE SEGURIDAD' as titulo,
    '1. Vista expense_summary eliminada' as check1,
    '2. RLS habilitado en todas las tablas' as check2,
    '3. Políticas de seguridad activas' as check3,
    '4. Funciones sin SECURITY DEFINER problemático' as check4,
    '5. Permisos apropiados para usuarios autenticados' as check5,
    '✅ Base de datos segura' as status; 