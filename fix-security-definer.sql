-- Script para solucionar el problema de seguridad SECURITY DEFINER
-- Ejecutar en el SQL Editor de Supabase

-- OPCIÓN 1: Eliminar la vista problemática (RECOMENDADO)
-- Ya que no se está usando en la aplicación
DROP VIEW IF EXISTS public.expense_summary;

-- OPCIÓN 2: Si necesitas mantener la vista, recrearla con RLS apropiado
-- (Descomenta las siguientes líneas si necesitas la vista)

/*
-- Recrear la vista sin SECURITY DEFINER
CREATE OR REPLACE VIEW public.expense_summary AS
SELECT 
    e.user_id,
    e.category,
    DATE_TRUNC('month', e.date) as month,
    COUNT(*) as transaction_count,
    SUM(e.amount) as total_amount,
    AVG(e.amount) as avg_amount,
    MIN(e.amount) as min_amount,
    MAX(e.amount) as max_amount
FROM public.user_expenses e
GROUP BY e.user_id, e.category, DATE_TRUNC('month', e.date);

-- Habilitar RLS en la vista
ALTER VIEW public.expense_summary ENABLE ROW LEVEL SECURITY;

-- Crear política de seguridad para la vista
CREATE POLICY "Users can only see their own expense summary" ON public.expense_summary
    FOR SELECT USING (auth.uid() = user_id);
*/

-- También eliminar la función que usa SECURITY DEFINER si no se necesita
DROP FUNCTION IF EXISTS public.get_expense_stats(UUID, DATE, DATE);

-- Recrear la función sin SECURITY DEFINER si es necesaria
CREATE OR REPLACE FUNCTION public.get_expense_stats(
    p_user_id UUID,
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
    start_date DATE := COALESCE(p_start_date, CURRENT_DATE - INTERVAL '6 months');
    end_date DATE := COALESCE(p_end_date, CURRENT_DATE);
BEGIN
    -- Verificar que el usuario solo pueda ver sus propios datos
    IF auth.uid() != p_user_id THEN
        RAISE EXCEPTION 'Access denied: You can only view your own expense statistics';
    END IF;

    SELECT jsonb_build_object(
        'total_amount', COALESCE(SUM(amount), 0),
        'total_count', COUNT(*),
        'avg_amount', COALESCE(AVG(amount), 0),
        'categories', (
            SELECT jsonb_object_agg(category, cat_data)
            FROM (
                SELECT 
                    category,
                    jsonb_build_object(
                        'total', SUM(amount),
                        'count', COUNT(*),
                        'avg', AVG(amount)
                    ) as cat_data
                FROM public.user_expenses 
                WHERE user_id = p_user_id 
                    AND date BETWEEN start_date AND end_date
                GROUP BY category
            ) cat_stats
        ),
        'monthly_totals', (
            SELECT jsonb_object_agg(month_year, month_total)
            FROM (
                SELECT 
                    TO_CHAR(date, 'YYYY-MM') as month_year,
                    SUM(amount) as month_total
                FROM public.user_expenses 
                WHERE user_id = p_user_id 
                    AND date BETWEEN start_date AND end_date
                GROUP BY TO_CHAR(date, 'YYYY-MM')
                ORDER BY month_year
            ) monthly_stats
        )
    ) INTO result
    FROM public.user_expenses 
    WHERE user_id = p_user_id 
        AND date BETWEEN start_date AND end_date;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Conceder permisos solo a usuarios autenticados
GRANT EXECUTE ON FUNCTION public.get_expense_stats(UUID, DATE, DATE) TO authenticated;

-- Verificar que las políticas RLS estén habilitadas en las tablas principales
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('user_expenses', 'user_categories', 'user_profiles', 'user_recurring_expenses');

-- Mensaje de confirmación
SELECT 'Problema de seguridad SECURITY DEFINER solucionado!' as status,
       'Vista expense_summary eliminada' as action1,
       'Función get_expense_stats recreada sin SECURITY DEFINER' as action2,
       'Verificar que RLS esté habilitado en todas las tablas' as action3; 