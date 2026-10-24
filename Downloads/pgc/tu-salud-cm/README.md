# Tu Salud CM

Prototipo local del aplicativo web para la gestión de citas ambulatorias de medicina general y el acceso digital a resultados clínicos de la E.S.E. Hospital El Salvador de Ubaté.

El sistema no se conecta al HIS institucional. La oferta de cupos es solo la que administración publica en el canal web. No incluye urgencias, telemedicina ni pagos.

## Arquitectura

Django implementa el modelo y los controladores de la API. React implementa las vistas. PostgreSQL guarda los datos y Redis cachea, durante 60 segundos, la lista de cupos disponibles de un médico y una fecha. La caché se invalida al bloquear, confirmar, liberar o generar cupos. Si Redis no responde, la consulta sigue saliendo de PostgreSQL.

```
tu-salud-cm/
  backend/
    config/                 configuración, JWT y middleware
    apps/login/             registro, ingreso, 2FA y menores
    apps/agenda/            horarios, citas y Lease Pattern
    apps/clinica/           PDF cifrados y analítica
  frontend/
    src/components/         layout, alertas y rutas protegidas
    src/modules/login/      páginas y servicios de acceso
    src/modules/agenda/     agendamiento y calendario
    src/modules/clinica/    resultados clínicos
    src/modules/admin/      solicitudes y analítica
    src/services/           cliente axios compartido
```

## Roles

| Rol | Qué puede hacer |
| --- | --- |
| Paciente | Agendar, cancelar, ver resultados propios y de sus menores |
| Médico | Ver su calendario, registrar asistencia y cargar PDF |
| Administración | Registrar médicos, definir jornadas, abrir cupos y ver analítica |

Un paciente recibe 403 si llama un endpoint de administración o de médicos. El rol viaja en el JWT como `is_patient`, `is_doctor` e `is_admin`.

## Seguridad

- Contraseñas con Argon2.
- Access token JWT de 30 minutos, solo en memoria del navegador.
- Refresh token en cookie `HttpOnly`, `SameSite=Lax`, rotada y puesta en lista negra al renovar o salir.
- El token temporal del segundo factor no autoriza el resto de la API.
- Tres contraseñas fallidas bloquean la cuenta 15 minutos.
- El registro exige el consentimiento de la Ley 1581 de 2012.
- Cada cita guarda la fecha de solicitud y la fecha de asignación para medir los tres días hábiles de la Resolución 1552 de 2013.
- Los PDF no se publican por URL. Se descargan por un endpoint autenticado y el archivo ya está cifrado con AES-256. La clave de apertura es el documento del paciente; la clave de propietario se queda en el servidor.

## Puesta en marcha

Requisitos: Python 3.12 o superior, Node.js 20 o superior y Docker.

```powershell
cd tu-salud-cm\backend
python -m venv venv
.\venv\Scripts\python.exe -m pip install -r requirements.txt
copy .env.example .env
.\venv\Scripts\python.exe manage.py migrate
.\venv\Scripts\python.exe manage.py runserver
```

En otra terminal:

```powershell
cd tu-salud-cm\frontend
npm install
npm run dev
```

Abra `http://localhost:5173`.

Cuentas de demostración:

- Administración: `admin@tusalud.local` / `Admin123*`
- Médico: `medico@tusalud.local` / `Medico123*`
- Paciente: `paciente@tusalud.local` / `Paciente123*`

El paciente de demostración tiene a cargo a Sofía Méndez. Su documento de prueba es `1098765432`; ese número es la clave del PDF si se carga un resultado para ella.

## Pruebas

Sin Docker se pueden ejecutar las pruebas sobre SQLite. PostgreSQL sigue siendo el motor del prototipo.

```powershell
cd backend
$env:USE_SQLITE='1'
$env:CACHE_BACKEND='locmem'
.\venv\Scripts\python.exe manage.py test
```

## Registro con doble verificación

Un paciente nuevo queda en `pendiente_verificacion` y no recibe sesión. El correo trae un enlace de un solo uso que vence a las 48 horas. Al confirmarlo, la cuenta pasa a `pendiente_aprobacion` y los administradores activos reciben el aviso. Desde **Solicitudes** se aprueba (`activo`) o se rechaza (`rechazado`). El ingreso solo abre sesión si el estado es `activo`.

Sin SMTP, Django imprime los correos en la consola del servidor. Con `DJANGO_DEBUG=1`, la respuesta del registro también incluye `enlace_debug`. Las cuentas creadas por `poblar_demo`, los médicos que da de alta administración y el superusuario nacen activos.

```powershell
cd backend
$env:USE_SQLITE='1'
$env:CACHE_BACKEND='locmem'
.\venv\Scripts\python.exe manage.py test apps.login.tests_verificacion
```

## Carga diferida

Las pantallas se importan con `React.lazy` dentro de `frontend/src/routes/AppRouter.jsx`. El navegador descarga el calendario, las gráficas y el resto de paneles solo cuando el usuario entra a esa ruta. `Suspense` muestra el estado de carga mientras llega el módulo. Eso ataca el cuello de botella de la carga inicial medido en el documento de grado.
