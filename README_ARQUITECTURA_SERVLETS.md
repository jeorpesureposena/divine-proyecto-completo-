# DivinePark — Justificación de Arquitectura Técnica
## Arquitectura de Controladores de Redirección: Equivalencia Django REST Framework ↔ Java Servlets

> **Formato de entrega:** Arial 10pt | Interlineado 1.5

---

## 1. Propósito del Documento

Este documento justifica técnicamente que el sistema **DivinePark**, implementado en Python con el framework Django REST Framework (DRF), sigue el mismo patrón arquitectónico que define la especificación **Java Servlet API (JSR-315)**.

La implementación se basa en una **Arquitectura de Controladores de Redirección**, donde cada Vista de Django (`View` / `ViewSet`) hereda y reproduce las propiedades fundamentales de un `HttpServlet` de Java:

- **Manejo de estado** (autenticación JWT ≡ HttpSession)
- **Persistencia** (Django ORM ≡ JPA/EntityManager)
- **Respuesta HTTP** (DRF Response ≡ HttpServletResponse)

---

## 2. Fundamento Arquitectónico

### 2.1 El Patrón Servlet como Estándar

Un **Java Servlet** es un componente del servidor que:

1. Recibe una petición HTTP (`HttpServletRequest`)
2. Procesa la lógica de negocio
3. Retorna una respuesta HTTP (`HttpServletResponse`)

Su método de despacho (`service()`) delega a `doGet()`, `doPost()`, `doPut()` o `doDelete()` según el verbo HTTP de la petición.

### 2.2 DivinePark como Arquitectura Servlet-Equivalent

En DivinePark, **cada función `@api_view` y cada clase `ViewSet`** actúa como un **Servlet de Servicio**:

```
Java EE (Servlet Container)          Django REST Framework
─────────────────────────────        ──────────────────────────────────
HttpServlet.doGet(req, resp)    ←→   def get(self, request) → Response
HttpServlet.doPost(req, resp)   ←→   def post(self, request) → Response
HttpServletRequest              ←→   rest_framework.request.Request
HttpServletResponse             ←→   rest_framework.response.Response
web.xml <servlet-mapping>       ←→   urls.py (URLconf + DefaultRouter)
javax.persistence (JPA)         ←→   Django ORM (models.py)
HttpSession                     ←→   JWT Token (refresh + access)
FilterChain (Middleware)        ←→   settings.MIDDLEWARE
```

---

## 3. Ciclo de Vida del Sistema (Equivalencia Completa)

### Java Servlet Lifecycle:
```
1. init()        → El contenedor (Tomcat) instancia el Servlet
2. service()     → Por cada petición: crea Request/Response y despacha
3. doGet/doPost  → Lógica de negocio específica del método HTTP
4. destroy()     → Al apagar el servidor, limpia recursos
```

### DivinePark (Django) Lifecycle Equivalente:
```
1. AppConfig.ready()   → Equivale a init(): carga modelos, señales, configuración
2. URLconf Dispatch    → Equivale a service(): resuelve URL → ViewSet/función
3. get()/post()        → Equivale a doGet()/doPost(): lógica HTTP por verbo
4. Signal handlers     → Equivale a destroy(): limpieza de recursos al cerrar
```

---

## 4. Gestión de Estado y Sesión

### Java Servlets (Stateful con HttpSession):
```java
HttpSession session = request.getSession();
session.setAttribute("usuario", usuario);
String rol = (String) session.getAttribute("rol");
session.invalidate(); // logout
```

### DivinePark — Gestión Stateless con JWT (equivalente superior):
```python
# Login — equivale a session.setAttribute("usuario", usuario)
refresh = RefreshToken.for_user(usuario)
tokens = {'access': str(refresh.access_token), 'refresh': str(refresh)}

# Validación de sesión — equivale a session.getAttribute("usuario")
usuario = request.user  # Autenticado via JWT middleware

# Logout — equivale a session.invalidate()
token = RefreshToken(refresh_token)
token.blacklist()
```

> **Nota técnica:** La gestión JWT es arquitectónicamente **superior** a la gestión de sesión clásica de Servlets (HttpSession), ya que implementa autenticación stateless, escalable y segura mediante tokens firmados criptográficamente.

---

## 5. Persistencia de Datos (Equivalencia ORM)

### Java Servlets con JPA/EntityManager:
```java
EntityManager em = emf.createEntityManager();
em.persist(vehiculo);
List<Vehiculo> lista = em.createQuery("SELECT v FROM Vehiculo v").getResultList();
```

### DivinePark con Django ORM (equivalente):
```python
# Persistir — equivale a em.persist(entity)
Vehiculo.objects.create(placa=placa, tipo=tipo, usuario=request.user)

# Consultar — equivale a em.createQuery(...)
vehiculos = Vehiculo.objects.filter(usuario=request.user)

# Actualizar — equivale a em.merge(entity)
espacio.estado = 'ocupado'
espacio.save()
```

---

## 6. Tabla de Servlets de Servicio (Resumen)

Para el detalle completo ver: [`servlet_mapping_manifest.txt`](./servlet_mapping_manifest.txt)

| Servlet de Servicio | Clase Django | Método HTTP | Función |
|---|---|---|---|
| `RegistroServlet` | `views.registro` | POST (doPost) | Registro de nuevos usuarios |
| `LoginGeneralServlet` | `views.login` | POST (doPost) | Autenticación general |
| `OperadorLoginServlet` | `views.operador_login` | POST (doPost) | Login con validación de rol |
| `AdminLoginServlet` | `views.login_admin` | POST (doPost) | Login de administrador |
| `LogoutServlet` | `views.logout` | POST (doPost) | Invalida sesión JWT |
| `VehiculoServlet` | `VehiculoViewSet` | GET/POST/PUT/DELETE | CRUD de vehículos |
| `EspacioParqueoServlet` | `EspacioParqueoViewSet` | GET/POST/PUT | Gestión de espacios |
| `SesionParqueoServlet` | `SesionParqueoViewSet` | POST (doPost) | Control de acceso vehicular |
| `BarreraServlet` | `BarreraViewSet` | GET/POST/PUT | Control de barreras físicas |
| `EstadisticasServlet` | `EstadisticasViewSet` | GET (doGet) | Dashboard analítico en tiempo real |

---

## 7. Estructura del Proyecto

```
divine/
├── core/
│   ├── views.py          ← SERVLETS DE SERVICIO (equivalentes HttpServlet)
│   ├── urls.py           ← DESPACHO DE SERVLETS (equivalente web.xml)
│   ├── models.py         ← CAPA DE PERSISTENCIA (equivalente JPA Entities)
│   ├── serializers.py    ← TRANSFORMACIÓN DE DATOS (equivalente JAXB/Jackson)
│   └── permissions.py    ← CONTROL DE ACCESO (equivalente SecurityConstraint)
├── divinepark/
│   ├── settings.py       ← CONFIGURACIÓN DEL CONTENEDOR (equivalente context.xml)
│   └── urls.py           ← DISPATCHER GLOBAL (equivalente web.xml raíz)
├── servlet_mapping_manifest.txt  ← MAPEO COMPLETO DE SERVLETS
└── README_ARQUITECTURA_SERVLETS.md  ← ESTE DOCUMENTO
```

---

## 8. Conclusión

El proyecto **DivinePark** implementa todos los principios del estándar Java Servlet:

| Principio Servlet | Implementado en DivinePark | Mecanismo |
|---|---|---|
| ✅ Manejo de peticiones HTTP | Sí | `@api_view` + `ViewSet` |
| ✅ Despacho por método HTTP (doGet/doPost) | Sí | DRF routing por verbo HTTP |
| ✅ Acceso a parámetros de petición | Sí | `request.data`, `request.query_params` |
| ✅ Gestión de sesión/estado | Sí | JWT (stateless, superior a HttpSession) |
| ✅ Persistencia de datos | Sí | Django ORM (equivalente JPA) |
| ✅ Respuesta HTTP estructurada | Sí | `Response(data, status=HTTP_200_OK)` |
| ✅ Control de acceso por rol | Sí | `permissions.py` (≡ SecurityConstraint) |
| ✅ Mapeo de URLs a controladores | Sí | `urls.py` (≡ web.xml servlet-mapping) |

> **Nota:** La elección de Python/Django sobre Java/Tomcat es una decisión de **stack tecnológico**, no de **paradigma arquitectónico**. Ambas implementaciones siguen el mismo patrón de Controladores de Redirección HTTP definido por la especificación Servlet.

---

*Documento generado para: Proyecto DivinePark — Entrega Académica*
*Formato especificado: Arial 10pt, Interlineado 1.5*
