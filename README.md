# Examen teórico ASP

Sitio separado del examen CB: muestra 30 preguntas aleatorias tomadas del banco ASP, oculta las respuestas correctas al público, califica en una Edge Function de Supabase y permite administrar el banco desde admin.html.

## Proyecto Supabase

Proyecto creado: `exam_asp`  
Project URL: `https://zndwsdfbqqjhzedbdoyr.supabase.co`

## Preparar Supabase

1. En SQL Editor ejecuta `supabase/migrations/202610230001_setup_asp.sql`.
2. Importa `supabase/seed.sql` en SQL Editor. Se genera con `node scripts/exportar-balotario-asp.mjs` desde esta carpeta.
3. Despliega `supabase/functions/asp-exam/index.ts` como Edge Function `asp-exam`.
4. Supabase proporciona `SUPABASE_URL` y `SUPABASE_SECRET_KEYS` al entorno de la función. El código usa la clave secret `default` del servidor, con compatibilidad para `SUPABASE_SERVICE_ROLE_KEY` heredada. No pegues ninguna clave secret en config.js ni en GitHub.
5. En la configuración de la función confirma `Verify JWT` desactivado para que la web pública llame el endpoint con la clave publishable.
6. Crea el usuario administrador en Authentication > Users. Después autoriza su UUID ejecutando:

```sql
insert into public.asp_admins(user_id)
select id from auth.users where email = 'CORREO_ADMIN'
on conflict (user_id) do nothing;
```

## Configurar y publicar la página

1. En `config.js`, la URL del proyecto ya está configurada. Reemplaza `TU_CLAVE_PUBLISHABLE` por la clave `sb_publishable_...` del proyecto `exam_asp`.
2. Publica `index.html`, `script.js`, `styles.css`, `config.js`, `admin.html`, `admin.js`, `admin.css`, `README.md`, `supabase/config.toml`, `supabase/functions` y `supabase/migrations` en GitHub Pages.
3. No publiques `preguntas-original.js` ni `supabase/seed.sql`: contienen respuestas correctas. Están excluidos por `.gitignore`, aunque al subir archivos manualmente debes omitirlos.
4. Entra a `/admin.html` con el correo y contraseña creados en Supabase Auth.

## Datos de este banco

El archivo recibido contiene 31 preguntas, IDs del 1 al 31, con cuatro alternativas cada una. La página muestra 30 preguntas por examen. Se conservó sin cambios el endpoint de Google Apps Script que ya aparecía en el JavaScript original. Ese endpoint debe tener acceso a la hoja ASP y puede revisarse en Apps Script > Ejecuciones.

La fuente original se conservó como `preguntas-original.js` para generar el seed, pero el archivo debe mantenerse privado.
