-- ============================================================
-- 03_meses_disponibles.sql — función para el selector de meses.
--
-- El cliente llenaba el selector con select('date') SIN límite, que PostgREST
-- recorta a 1.000 filas en silencio: con importaciones de 50-150 movimientos
-- al mes, los meses antiguos desaparecerían del selector sin ningún error.
-- El DISTINCT se hace ahora en la base, donde no hay tope: viajan unos pocos
-- 'YYYY-MM' en lugar de una fila por gasto.
--
-- DÓNDE SE EJECUTA: en el SQL Editor del panel web de Supabase (navegador),
-- pegando el contenido y pulsando Run. Es idempotente (CREATE OR REPLACE).
--
-- SECURITY INVOKER a propósito: la función corre como el usuario que llama y
-- las políticas RLS de user_expenses se aplican con normalidad. El filtro por
-- auth.uid() es redundante con RLS, y se deja igualmente: si algún día una
-- política se relaja por error, esta función no se convierte en la fuga.
-- Para un invitado (auth.uid() NULL) devuelve vacío, no error.
-- ============================================================

CREATE OR REPLACE FUNCTION meses_con_gastos()
RETURNS TABLE (mes text)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  -- left(...::text, 7) y no to_char: funciona igual si la columna es DATE o
  -- texto 'YYYY-MM-DD', y el formato ISO ordena bien como cadena.
  SELECT DISTINCT left(date::text, 7)
  FROM user_expenses
  WHERE user_id = auth.uid()
    AND source <> 'card_import_excluded'
  ORDER BY 1;
$$;

-- Comprobación (debe listar los meses del usuario actual; desde el editor de
-- Supabase auth.uid() es NULL, así que aquí lo esperable es 0 filas — la
-- prueba real es desde la aplicación):
SELECT * FROM meses_con_gastos();
