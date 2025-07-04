-- ===========================================
-- ACTUALIZACIÓN PARA NUEVAS FUNCIONALIDADES
-- ===========================================
-- Ejecuta este script DESPUÉS de tu configuración existente

-- ===========================================
-- AGREGAR CAMPOS FALTANTES A user_expenses
-- ===========================================
-- Campos para OCR y merchant tracking
ALTER TABLE public.user_expenses 
ADD COLUMN IF NOT EXISTS merchant TEXT,
ADD COLUMN IF NOT EXISTS receipt_url TEXT,
ADD COLUMN IF NOT EXISTS confidence_score DECIMAL(3,2);

-- ===========================================
-- TABLA: report_configs (NUEVA - para informes automáticos)
-- ===========================================
CREATE TABLE IF NOT EXISTS public.report_configs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    template_id TEXT NOT NULL,
    name TEXT NOT NULL,
    frequency TEXT NOT NULL CHECK (frequency IN ('weekly', 'monthly', 'quarterly')),
    email TEXT NOT NULL,
    categories TEXT[] DEFAULT '{}',
    date_range INTEGER DEFAULT 6,
    enabled BOOLEAN DEFAULT TRUE,
    last_run TIMESTAMP WITH TIME ZONE,
    next_run TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS para report_configs
ALTER TABLE public.report_configs ENABLE ROW LEVEL SECURITY;

-- Políticas para report_configs
CREATE POLICY "Users can view own report configs" ON public.report_configs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own report configs" ON public.report_configs
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own report configs" ON public.report_configs
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own report configs" ON public.report_configs
    FOR DELETE USING (auth.uid() = user_id);

-- Trigger para updated_at en report_configs
CREATE TRIGGER handle_updated_at_report_configs
    BEFORE UPDATE ON public.report_configs
    FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

-- Índices para report_configs
CREATE INDEX IF NOT EXISTS idx_report_configs_user_id ON public.report_configs(user_id);
CREATE INDEX IF NOT EXISTS idx_report_configs_next_run ON public.report_configs(next_run);
CREATE INDEX IF NOT EXISTS idx_report_configs_enabled ON public.report_configs(enabled, next_run);

-- ===========================================
-- TABLA: batch_processing_jobs (NUEVA - para seguimiento de batch)
-- ===========================================
CREATE TABLE IF NOT EXISTS public.batch_processing_jobs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    job_name TEXT NOT NULL,
    total_files INTEGER NOT NULL,
    processed_files INTEGER DEFAULT 0,
    successful_files INTEGER DEFAULT 0,
    failed_files INTEGER DEFAULT 0,
    status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    settings JSONB DEFAULT '{}',
    results JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS para batch_processing_jobs
ALTER TABLE public.batch_processing_jobs ENABLE ROW LEVEL SECURITY;

-- Políticas para batch_processing_jobs
CREATE POLICY "Users can view own batch jobs" ON public.batch_processing_jobs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own batch jobs" ON public.batch_processing_jobs
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own batch jobs" ON public.batch_processing_jobs
    FOR UPDATE USING (auth.uid() = user_id);

-- Trigger para updated_at en batch_processing_jobs
CREATE TRIGGER handle_updated_at_batch_jobs
    BEFORE UPDATE ON public.batch_processing_jobs
    FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

-- Índices para batch_processing_jobs
CREATE INDEX IF NOT EXISTS idx_batch_jobs_user_id ON public.batch_processing_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_batch_jobs_status ON public.batch_processing_jobs(status);

-- ===========================================
-- FUNCIONES AUXILIARES PARA INFORMES
-- ===========================================

-- Función para obtener estadísticas de gastos por usuario
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- VISTA PARA REPORTES RÁPIDOS
-- ===========================================
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

-- RLS para la vista
ALTER VIEW public.expense_summary OWNER TO postgres;

-- ===========================================
-- DATOS DE EJEMPLO (OPCIONAL)
-- ===========================================
-- Función para crear datos de ejemplo para testing
CREATE OR REPLACE FUNCTION public.create_sample_data(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
    sample_categories TEXT[] := ARRAY['Alimentación', 'Transporte', 'Ocio', 'Salud'];
    sample_merchants TEXT[] := ARRAY['Mercadona', 'Carrefour', 'Amazon', 'Gasolinera Shell'];
    i INTEGER;
    random_date DATE;
    random_amount DECIMAL(10,2);
    random_category TEXT;
    random_merchant TEXT;
BEGIN
    -- Crear 20 gastos de ejemplo de los últimos 3 meses
    FOR i IN 1..20 LOOP
        random_date := CURRENT_DATE - (random() * 90)::INTEGER;
        random_amount := (random() * 200 + 10)::DECIMAL(10,2);
        random_category := sample_categories[1 + (random() * array_length(sample_categories, 1))::INTEGER];
        random_merchant := sample_merchants[1 + (random() * array_length(sample_merchants, 1))::INTEGER];
        
        INSERT INTO public.user_expenses (
            user_id, amount, category, merchant, date, 
            note, confidence_score
        ) VALUES (
            p_user_id, 
            random_amount, 
            random_category, 
            random_merchant,
            random_date,
            'Gasto de ejemplo generado automáticamente',
            (0.7 + random() * 0.3)::DECIMAL(3,2)
        );
    END LOOP;
    
    RAISE NOTICE 'Se crearon 20 gastos de ejemplo para el usuario %', p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- CONFIRMACIÓN
-- ===========================================
SELECT 'Actualización completada! Nuevas funcionalidades disponibles:' as message,
       '- Informes automáticos configurables' as feature1,
       '- Batch processing con seguimiento' as feature2,
       '- Campos OCR en gastos (merchant, confidence)' as feature3,
       '- Funciones de estadísticas avanzadas' as feature4; 