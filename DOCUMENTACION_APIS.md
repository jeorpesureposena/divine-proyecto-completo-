# DOCUMENTACIÓN DE SERVICIOS WEB (APIS)
## PROYECTO FORMATIVO: DIVINEPARK

**Evidencia de Desempeño:** Diseño y Desarrollo de Servicios Web - Proyecto  
**Código de Guía:** GA7-220501096-AA5-EV03  
**Programa de Formación:** Tecnólogo en Análisis y Desarrollo de Software (ADSO)  
**Institución:** Servicio Nacional de Aprendizaje (SENA)  

---

## 1. Introducción y Arquitectura

El sistema **DivinePark** es una plataforma de gestión inteligente de estacionamientos. La arquitectura del backend está basada en **servicios REST (APIs)** implementados en Python con el framework **Django REST Framework (DRF)**.

A pesar de estar implementada en Python, la arquitectura del backend sigue el patrón estándar de **Controladores de Redirección (Servlet-Equivalent)**. Esto significa que cada vista o controlador HTTP (View/ViewSet) en Django tiene una equivalencia funcional directa con la especificación de la API **Java Servlet (javax.servlet.http.HttpServlet)**, manejando:
*   **Peticiones y Respuestas HTTP:** (`Request` ≡ `HttpServletRequest`, `Response` ≡ `HttpServletResponse`).
*   **Despacho por Verbo HTTP (Rutas):** El sistema de URLconf (`urls.py`) cumple la función del descriptor de despliegue `web.xml` (mapeando URLs a servlets).
*   **Persistencia:** Mediante Django ORM (equivalente a JPA / Hibernate).
*   **Seguridad y Sesión:** Autenticación Stateless usando tokens **JWT (JSON Web Tokens)** (equivalente y superior a `HttpSession`).

---

## 2. Tecnologías Utilizadas

*   **Lenguaje de Programación:** Python 3.13
*   **Framework Principal:** Django 5.x / 6.x + Django REST Framework (DRF)
*   **Base de Datos:** SQLite / PostgreSQL (mediante Django ORM)
*   **Autenticación:** JWT (Simple JWT)
*   **Control de Versiones:** Git (repositorio local y remoto)
*   **Herramienta de Pruebas:** Postman

---

## 3. Mapeo Arquitectónico y Despachador (Django vs Java Servlet)

El archivo `urls.py` de Django actúa como el despachador de solicitudes (`web.xml` o anotaciones `@WebServlet` de Java EE). A continuación se resume la tabla de equivalencias de componentes:

| COMPONENTE JAVA EE | COMPONENTE DJANGO / DRF | DESCRIPCIÓN |
| :--- | :--- | :--- |
| `javax.servlet.http.HttpServlet` | `rest_framework.views.APIView` o `viewsets.ModelViewSet` | Controlador principal de servicios |
| `doGet(req, resp)` | `def get(self, request)` / `def retrieve()` / `def list()` | Manejador del método HTTP GET |
| `doPost(req, resp)` | `def post(self, request)` / `def create()` | Manejador del método HTTP POST |
| `doPut(req, resp)` | `def put(self, request)` / `def update()` | Manejador del método HTTP PUT |
| `doDelete(req, resp)` | `def delete(self, request)` / `def destroy()` | Manejador del método HTTP DELETE |
| `req.getParameter("x")` | `request.data.get('x')` o `request.query_params.get('x')` | Extracción de datos y parámetros |
| `req.getUserPrincipal()` | `request.user` | Obtención del usuario autenticado (JWT) |
| `web.xml` | `urls.py` | Descriptor de despliegue y mapeo de rutas de la aplicación |

---

## 4. Catálogo y Especificación Técnica de Servicios (APIs)

### 4.1 Módulo de Autenticación y Sesión (Auth)

Este módulo gestiona la creación de cuentas, inicios de sesión para distintos roles, refresco de sesiones y recuperación de contraseñas.

#### 4.1.1 Registro de Usuario (`RegistroServlet`)
*   **Ruta:** `/api/auth/registro/`
*   **Método HTTP:** `POST` (Equivalente Java: `doPost`)
*   **Descripción:** Registra un nuevo usuario en la plataforma.
*   **Seguridad:** Pública.
*   **Cuerpo de la Petición (JSON):**
    ```json
    {
      "nombre": "Juan Pérez",
      "correo": "juan.perez@email.com",
      "password": "PasswordSegura123*",
      "password2": "PasswordSegura123*",
      "rol": "conductor"
    }
    ```
*   **Respuesta Exitosa (201 Created):**
    ```json
    {
      "mensaje": "Usuario registrado exitosamente",
      "usuario": { "id": 1, "nombre": "Juan Pérez", "correo": "juan.perez@email.com", "rol": "conductor", "estado": true },
      "tokens": { "refresh": "eyJhb...", "access": "eyJhb..." }
    }
    ```

#### 4.1.2 Inicio de Sesión General (`LoginGeneralServlet`)
*   **Ruta:** `/api/auth/login/`
*   **Método:** `POST`
*   **Descripción:** Autentica a conductores y genera tokens JWT.
*   **Cuerpo de la Petición (JSON):**
    ```json
    {
      "correo": "juan.perez@email.com",
      "password": "PasswordSegura123*"
    }
    ```
*   **Respuesta Exitosa (200 OK):**
    ```json
    {
      "mensaje": "Login exitoso",
      "usuario": { "id": 1, "nombre": "Juan Pérez", "rol": "conductor" },
      "tokens": { "refresh": "...", "access": "..." }
    }
    ```

#### 4.1.3 Inicio de Sesión de Operador (`OperadorLoginServlet`)
*   **Ruta:** `/api/auth/operador-login/`
*   **Método:** `POST`
*   **Descripción:** Inicio de sesión específico para personal operativo mediante código asignado.
*   **Cuerpo de la Petición (JSON):**
    ```json
    {
      "correo": "operador@divinepark.com",
      "password": "PasswordOperador123*",
      "codigo_operador": "OP-12345"
    }
    ```

#### 4.1.4 Inicio de Sesión de Administrador (`AdminLoginServlet`)
*   **Ruta:** `/api/auth/login-admin/`
*   **Método:** `POST`
*   **Descripción:** Acceso administrativo exclusivo.
*   **Cuerpo de la Petición (JSON):**
    ```json
    {
      "correo": "admin@divinepark.com",
      "password": "PasswordAdmin123*"
    }
    ```

#### 4.1.5 Ver Perfil de Usuario (`PerfilServlet`)
*   **Ruta:** `/api/auth/perfil/`
*   **Método:** `GET`
*   **Seguridad:** Requiere Token Bearer (`Authorization: Bearer <access_token>`).
*   **Descripción:** Retorna los datos personales del usuario logueado en la sesión.

#### 4.1.6 Cambiar Contraseña (`CambiarPasswordServlet`)
*   **Ruta:** `/api/auth/cambiar-password/`
*   **Método:** `POST`
*   **Seguridad:** Autenticado.
*   **Cuerpo de la Petición (JSON):**
    ```json
    {
      "password_actual": "PasswordSegura123*",
      "password_nuevo": "NuevaPassword456*",
      "password_nuevo2": "NuevaPassword456*"
    }
    ```

#### 4.1.7 Recuperar Contraseña: Enviar Código (`EnviarCodigoRecuperacionServlet`)
*   **Ruta:** `/api/auth/recuperar-password/enviar-codigo/`
*   **Método:** `POST`
*   **Descripción:** Envía un código OTP de 6 dígitos al correo registrado.
*   **Cuerpo de la Petición (JSON):**
    ```json
    { "correo": "juan.perez@email.com" }
    ```

#### 4.1.8 Recuperar Contraseña: Verificar Código (`VerificarCodigoServlet`)
*   **Ruta:** `/api/auth/recuperar-password/verificar-codigo/`
*   **Método:** `POST`
*   **Cuerpo de la Petición (JSON):**
    ```json
    { "correo": "juan.perez@email.com", "codigo": "123456" }
    ```

#### 4.1.9 Recuperar Contraseña: Restablecer (`RestablecerPasswordServlet`)
*   **Ruta:** `/api/auth/recuperar-password/restablecer/`
*   **Método:** `POST`
*   **Cuerpo de la Petición (JSON):**
    ```json
    {
      "correo": "juan.perez@email.com",
      "codigo": "123456",
      "password_nuevo": "NuevaPassword123*",
      "password_nuevo2": "NuevaPassword123*"
    }
    ```

#### 4.1.10 Cierre de Sesión (`LogoutServlet`)
*   **Ruta:** `/api/auth/logout/`
*   **Método:** `POST`
*   **Descripción:** Invalida el token refresh enviándolo a la lista negra.
*   **Cuerpo de la Petición (JSON):**
    ```json
    { "refresh": "eyJhbGciOiJIUzI1NiIsInR5c..." }
    ```

#### 4.1.11 Refrescar Token (`TokenRefreshServlet`)
*   **Ruta:** `/api/auth/refresh/`
*   **Método:** `POST`
*   **Descripción:** Obtiene un nuevo token de acceso a partir de un token de refresco válido.

---

### 4.2 Módulo de Gestión de Espacios y Sensores (`EspacioParqueoServlet`)

Este módulo controla los espacios de estacionamiento físicos y sus sensores IoT de piso.

#### 4.2.1 Listar Espacios de Parqueo
*   **Ruta:** `/api/espacios/`
*   **Método HTTP:** `GET`
*   **Descripción:** Retorna una lista con todos los espacios y su estado dinámico actual (`libre`, `ocupado`, `reservado` o `mantenimiento`).

#### 4.2.2 Crear/Modificar Espacio de Parqueo
*   **Ruta:** `/api/espacios/` (POST) o `/api/espacios/{id}/` (PUT / PATCH)
*   **Descripción:** Permite registrar un espacio o actualizar sus atributos.
*   **Regla de Negocio Especial:** Si un espacio pasa de estado `mantenimiento` a cualquier otro estado (`libre`, `ocupado`, etc.), los campos `motivo_mantenimiento` y `duracion_mantenimiento` se limpian automáticamente a `null` para preservar la coherencia operativa.
*   **Cuerpo de la Petición (JSON) para Mantenimiento:**
    ```json
    {
      "estado": "mantenimiento",
      "motivo_mantenimiento": "Fallo en el sensor de piso",
      "duracion_mantenimiento": "Indefinido"
    }
    ```

#### 4.2.3 Consultar Espacios Disponibles por Rango Horario
*   **Ruta:** `/api/espacios/disponibles/`
*   **Método HTTP:** `GET`
*   **Parámetros Query:** `inicio` (ISO string), `fin` (ISO string)
*   **Descripción:** Lista únicamente los espacios libres de reservas u ocupaciones en la franja horaria solicitada.

#### 4.2.4 CRUD de Sensores IoT (`SensorServlet`)
*   **Ruta:** `/api/sensores/` y `/api/sensores/{id}/`
*   **Métodos:** `GET` / `POST` / `PUT` / `PATCH` / `DELETE`
*   **Descripción:** Registra y audita el estado físico de los sensores IoT.

---

### 4.3 Módulo de Reservas y Tarifas

#### 4.3.1 CRUD de Reservas (`ReservaServlet`)
*   **Ruta:** `/api/reservas/` y `/api/reservas/{id}/`
*   **Métodos:** `GET` / `POST` / `PUT` / `PATCH` / `DELETE`
*   **Descripción:** Permite a conductores apartar un espacio de parqueo por anticipado. Valida solapamientos e introduce una ventana de gracia de 15 minutos.
*   **Cuerpo de la Petición (POST):**
    ```json
    {
      "espacio": 1,
      "vehiculo": 2,
      "fecha_inicio": "2026-07-10T15:00:00Z",
      "fecha_fin": "2026-07-10T17:00:00Z"
    }
    ```

#### 4.3.2 CRUD de Tarifas (`TarifaServlet`)
*   **Ruta:** `/api/tarifas/` y `/api/tarifas/{id}/`
*   **Métodos:** `GET` / `POST` / `PUT` / `PATCH` / `DELETE`
*   **Descripción:** Define el precio cobrado por minuto/hora dependiendo del tipo de vehículo.

---

### 4.4 Módulo de Sesiones de Parqueo y Control de Acceso

Maneja el ingreso/salida físico y el cálculo de cobros.

#### 4.4.1 Registrar Entrada Manual (`EntradaManualServlet`)
*   **Ruta:** `/api/sesiones/entrada-manual/`
*   **Método HTTP:** `POST`
*   **Descripción:** Registra el ingreso de un vehículo, abriendo una sesión activa e imprimiendo la hora de entrada.
*   **Cuerpo de la Petición (JSON):**
    ```json
    {
      "placa": "ABC123",
      "tipo_vehiculo": "carro",
      "espacio_numero": 101
    }
    ```

#### 4.4.2 Registrar Salida Manual y Cobro (`SalidaManualServlet`)
*   **Ruta:** `/api/sesiones/{id}/salida-m/`
*   **Método HTTP:** `POST`
*   **Descripción:** Registra la hora de egreso, calcula el tiempo transcurrido en base a tarifas vigentes, deduce el dinero o requiere efectivo y finaliza la sesión de parqueo.
*   **Cuerpo de la Petición (JSON):**
    ```json
    {
      "metodo_pago": "efectivo"
    }
    ```

#### 4.4.3 Listar Eventos de Acceso (`EventoAccesoServlet`)
*   **Ruta:** `/api/eventos/`
*   **Método:** `GET`
*   **Descripción:** Bitácora histórica de aperturas de barreras y detecciones.

#### 4.4.4 Autorizaciones Excepcionales (`AutorizacionExcepcionalServlet`)
*   **Ruta:** `/api/autorizaciones/`
*   **Método:** `GET` / `POST`
*   **Descripción:** Permite a operadores abrir barreras manualmente por contingencias.

---

### 4.5 Módulo de Vehículos (`VehiculoServlet`)

*   **Ruta:** `/api/vehiculos/` y `/api/vehiculos/{id}/`
*   **Métodos:** `GET` / `POST` / `PUT` / `PATCH` / `DELETE`
*   **Descripción:** Los conductores configuran sus vehículos propios asociados a sus cuentas.
*   **Cuerpo de la Petición (POST):**
    ```json
    {
      "placa": "XYZ789",
      "tipo": "carro",
      "marca": "Chevrolet",
      "color": "Gris",
      "modelo": "2024"
    }
    ```

---

### 4.6 Módulo de Pagos y Billetera Virtual

Gestiona el monedero digital y recargas para habilitar pagos sin efectivo.

#### 4.6.1 Listar Pagos (`PagoServlet`)
*   **Ruta:** `/api/pagos/`

#### 4.6.2 Descargar Factura
*   **Ruta:** `/api/pagos/{id}/factura/`
*   **Método:** `GET`
*   **Descripción:** Genera un comprobante detallado de la sesión de parqueo finalizada.

#### 4.6.3 Ver Mi Billetera (`BilleteraServlet`)
*   **Ruta:** `/api/billetera/mi_billetera/`
*   **Método:** `GET`
*   **Descripción:** Retorna el saldo y el estado de la billetera virtual del conductor logueado.

#### 4.6.4 Ver Historial de Facturas
*   **Ruta:** `/api/billetera/mis_facturas/`
*   **Método:** `GET`

#### 4.6.5 Recargar Billetera (`RecargaServlet`)
*   **Ruta:** `/api/recargas/`
*   **Método:** `POST`
*   **Cuerpo de la Petición (JSON):**
    ```json
    {
      "monto": 25000.0,
      "metodo": "pse"
    }
    ```

---

### 4.7 Módulo de Estadísticas y Tablero Analítico

Facilita al administrador/operador la toma de decisiones mediante telemetría consolidadas.

#### 4.7.1 KPIs Tablero General (`TableroServlet`)
*   **Ruta:** `/api/estadisticas/tablero/`
*   **Método:** `GET`
*   **Descripción:** Entrega el total de espacios libres, ocupados, tasa de ocupación e ingresos monetarios del día.

#### 4.7.2 Reporte de Ventas (`VentasServlet`)
*   **Ruta:** `/api/estadisticas/ventas/`
*   **Método:** `GET`
*   **Descripción:** Consolida históricos de facturación del mes para auditorías financieras.

#### 4.7.3 Alertas de Tiempo Excedido (`AlertasTiempoServlet`)
*   **Ruta:** `/api/estadisticas/alertas_tiempo/`
*   **Método:** `GET`
*   **Descripción:** Identifica vehículos parqueados que han superado el tiempo máximo de reserva o estadía permitida.

---

### 4.8 Módulo de Dispositivos OCR, Barreras y Notificaciones

#### 4.8.1 Cámaras OCR (`CamaraOCRServlet`)
*   **Ruta:** `/api/camaras/` y `/api/camaras/{id}/`
*   **Descripción:** CRUD de las cámaras lectoras ubicadas en las entradas/salidas.

#### 4.8.2 Lecturas OCR
*   **Ruta:** `/api/lecturas/`
*   **Método:** `GET`
*   **Descripción:** Bitácora de las placas leídas por las cámaras automatizadas.

#### 4.8.3 Barreras Vehiculares (`BarreraServlet`)
*   **Ruta:** `/api/barreras/` y `/api/barreras/{id}/`
*   **Descripción:** Abre o cierra de forma remota/física las barreras electromecánicas.

#### 4.8.4 Notificaciones (`NotificacionServlet`)
*   **Ruta:** `/api/notificaciones/`
*   **Descripción:** Historial de alertas enviadas al conductor (ej. "Su tiempo está por vencer").

---

## 5. Control de Versiones (Git)

El proyecto se encuentra versionado local y remotamente para garantizar el seguimiento del código y desarrollo continuo. El flujo cuenta con un historial de commits descriptivos:

*   `commit bd6b8eb2...` - *"ultimo proyecto"* (Integración final y pruebas)
*   `commit 22d63819...` - *"proyecto completo-web"*
*   `commit 1e659dd1...` - *"arreglo de idiomas y algunos objetos visuales"*
*   `commit e778e1e7...` - *"ultimo arreglado de todo el front con el back"*
*   `commit 6a89f53a...` - *"base de datos y frontend del operador"*

---

## 6. Cómo Importar y Probar en Postman

Para facilitar la prueba de todos los servicios descritos en este documento, se ha adjuntado el archivo de colección de Postman **`DivinePark.postman_collection.json`** en la raíz del proyecto.

### Pasos para realizar las pruebas:
1.  **Abrir Postman.**
2.  Hacer clic en el botón **Import** (Importar) en la esquina superior izquierda.
3.  Seleccionar el archivo `DivinePark.postman_collection.json` ubicado en el directorio raíz del proyecto.
4.  Configurar las **Variables de Colección** en Postman (pestaña *Variables* de la colección importada):
    *   `base_url`: Dirección local del backend (ej. `http://127.0.0.1:8000`).
    *   `access_token`: Token de acceso JWT generado al iniciar sesión (se copia del login y se pega aquí).
    *   `refresh_token`: Token de refresco JWT (se copia del login y se pega aquí).
5.  Ejecutar las peticiones en orden: primero el **Registro de Usuario**, luego el **Login General** para obtener los tokens, y finalmente los endpoints de espacios, reservas y sesiones de parqueo.
