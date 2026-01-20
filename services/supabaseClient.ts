import { createClient } from '@supabase/supabase-js';

// Usamos las credenciales proporcionadas como fallback si no hay variables de entorno.
// NOTA: La key proporcionada (sb_publishable...) parece ser de un formato específico. 
// Si falla, asegúrate de copiar la "anon public key" (que suele empezar por eyJ...) desde:
// Project Settings -> API -> Project API keys
const supabaseUrl = process.env.SUPABASE_URL || 'https://axvnntbijuzdkrbmkrwq.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'sb_publishable_vIUi6aeCNBYo_aMU67ayEA_jbXLoIQo';

export const supabase = createClient(supabaseUrl, supabaseKey);

export const isSupabaseConfigured = () => {
  // Consideramos que está configurado si tenemos las credenciales hardcodeadas o por variables de entorno
  return (!!process.env.SUPABASE_URL || !!supabaseUrl) && (!!process.env.SUPABASE_ANON_KEY || !!supabaseKey);
};

/**
 * Verifica si un código ya existe en la base de datos.
 * Retorna true si existe, false si está libre.
 */
export const checkCodeExists = async (code: string): Promise<boolean> => {
  const { data, error } = await supabase
    .from('temp_files')
    .select('id')
    .eq('code', code)
    .maybeSingle();
  
  return !!data;
};