from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate
from .models import Usuario
from .serializers import RegistroSerializer, UsuarioSerializer, CambiarPasswordSerializer
import logging

# =============================================================================
# DIVINE PARK — CAPA DE CONTROLADORES HTTP (SERVLET-EQUIVALENT ARCHITECTURE)
# =============================================================================
# [ARCHITECTURE_MAPPING]: Django REST Framework como contenedor de Servlets
#
# Equivalencia de Componentes:
#   Java EE  (Servlet Container)     ←→  Django (WSGI/ASGI Application Server)
#   HttpServlet (clase base)         ←→  APIView / @api_view decorator
#   HttpServletRequest               ←→  rest_framework.request.Request (request)
#   HttpServletResponse              ←→  rest_framework.response.Response
#   web.xml / servlet-mapping        ←→  urls.py (URLconf Dispatcher)
#   doGet(req, resp)                 ←→  def get(self, request) / @api_view(['GET'])
#   doPost(req, resp)                ←→  def post(self, request) / @api_view(['POST'])
#   ServletContext (application)     ←→  Django settings + AppConfig
#   HttpSession                      ←→  JWT Token (refresh + access)
#   init() / destroy()               ←→  AppConfig.ready() / signal handlers
#
# Nota: El objeto `request` de Django REST Framework encapsula todos los datos
# de la petición HTTP entrante (método, headers, body, parámetros) de forma
# análoga al objeto HttpServletRequest en Java EE.
# =============================================================================


# ─── REGISTRO ─────────────────────────────────────────────────────
# [ARCHITECTURE_MAPPING]: Servlet-Equivalent
# Role: HttpServlet Controller — Servlet de Registro de Usuario
# Lifecycle Management: Manejo de peticiones síncronas mediante método de instancia.
# Equivalencia: doPost(HttpServletRequest req, HttpServletResponse resp)
#   → El objeto `request` actúa como HttpServletRequest:
#     request.data       ≡ req.getParameter() / req.getInputStream()
#     request.method     ≡ req.getMethod()
#     Response(...)      ≡ resp.getWriter().write() + resp.setStatus()
@api_view(['POST'])
@permission_classes([AllowAny])
def registro(request):
    """
    Controlador para el registro de nuevos usuarios en el sistema.
    """
    serializer = RegistroSerializer(data=request.data)
    if serializer.is_valid():
        usuario = serializer.save()
        refresh = RefreshToken.for_user(usuario)
        return Response({
            'mensaje': 'Usuario registrado exitosamente',
            'usuario': UsuarioSerializer(usuario).data,
            'tokens': {
                'refresh': str(refresh),
                'access' : str(refresh.access_token),
            }
        }, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# ─── LOGIN ────────────────────────────────────────────────────────
# [ARCHITECTURE_MAPPING]: Servlet-Equivalent
# Role: HttpServlet Controller — Servlet de Autenticación General
# Lifecycle Management: Manejo de peticiones síncronas mediante método de instancia.
# doPost → Recibe credenciales via request.data (≡ req.getParameter()),
#          autentica y retorna JWT (≡ HttpSession + setAttribute).
@api_view(['POST'])
@permission_classes([AllowAny])
def login(request):
    """
    Controlador para la autenticación general de usuarios.
    """
    correo   = request.data.get('correo')
    password = request.data.get('password')

    if not correo or not password:
        return Response({'error': 'Correo y contraseña son requeridos'}, status=status.HTTP_400_BAD_REQUEST)

    usuario = authenticate(request, username=correo, password=password)

    if usuario is None:
        return Response({'error': 'Credenciales incorrectas'}, status=status.HTTP_401_UNAUTHORIZED)

    if not usuario.estado:
        return Response({'error': 'Usuario inactivo'}, status=status.HTTP_403_FORBIDDEN)

    refresh = RefreshToken.for_user(usuario)
    return Response({
        'mensaje': 'Login exitoso',
        'usuario': UsuarioSerializer(usuario).data,
        'tokens': {
            'refresh': str(refresh),
            'access' : str(refresh.access_token),
        }
    })


# [ARCHITECTURE_MAPPING]: Servlet-Equivalent
# Role: HttpServlet Controller — Servlet de Login de Operador
# Lifecycle Management: Petición POST síncrona con validación de rol.
# doPost → request.data.get('correo') ≡ req.getParameter("correo")
#          Verifica rol antes de emitir token (≡ session.setAttribute("rol", ...)).
@api_view(['POST'])
@permission_classes([AllowAny])
def operador_login(request):
    """Login específico para la interfaz de Operador.
    Valida credenciales y además que el usuario tenga `rol == 'operador'`.
    """
    correo = request.data.get('correo')
    password = request.data.get('password')

    if not correo or not password:
        return Response({'error': 'Correo y contraseña son requeridos'}, status=status.HTTP_400_BAD_REQUEST)

    usuario = authenticate(request, username=correo, password=password)

    if usuario is None:
        return Response({'error': 'Credenciales incorrectas'}, status=status.HTTP_401_UNAUTHORIZED)

    # Verificar rol de operador
    if getattr(usuario, 'rol', None) != 'operador':
        return Response({'error': 'Acceso restringido a operadores'}, status=status.HTTP_403_FORBIDDEN)

    if not usuario.estado:
        return Response({'error': 'Usuario inactivo'}, status=status.HTTP_403_FORBIDDEN)

    refresh = RefreshToken.for_user(usuario)
    return Response({
        'mensaje': 'Login exitoso',
        'usuario': UsuarioSerializer(usuario).data,
        'tokens': {
            'refresh': str(refresh),
            'access': str(refresh.access_token),
        }
    })


# [ARCHITECTURE_MAPPING]: Servlet-Equivalent
# Role: HttpServlet Controller — Servlet de Login de Administrador
# Lifecycle Management: Petición POST síncrona con validación de rol elevado.
# doPost → Verifica `rol == 'administrador'` antes de otorgar token JWT.
@api_view(['POST'])
@permission_classes([AllowAny])
def login_admin(request):
    """Login específico para la interfaz de Administrador.
    Valida credenciales y además que el usuario tenga `rol == 'administrador'`.
    """
    correo = request.data.get('correo')
    password = request.data.get('password')

    if not correo or not password:
        return Response({'error': 'Correo y contraseña son requeridos'}, status=status.HTTP_400_BAD_REQUEST)

    usuario = authenticate(request, username=correo, password=password)

    if usuario is None:
        return Response({'error': 'Credenciales incorrectas'}, status=status.HTTP_401_UNAUTHORIZED)

    # Verificar rol de administrador
    if getattr(usuario, 'rol', None) != 'administrador':
        return Response({'error': 'Acceso restringido a administradores'}, status=status.HTTP_403_FORBIDDEN)

    if not usuario.estado:
        return Response({'error': 'Usuario inactivo'}, status=status.HTTP_403_FORBIDDEN)

    refresh = RefreshToken.for_user(usuario)
    return Response({
        'mensaje': 'Login exitoso',
        'usuario': UsuarioSerializer(usuario).data,
        'tokens': {
            'refresh': str(refresh),
            'access': str(refresh.access_token),
        }
    })


# ─── PERFIL ───────────────────────────────────────────────────────
# [ARCHITECTURE_MAPPING]: Servlet-Equivalent
# Role: HttpServlet Controller — Servlet de Consulta de Perfil
# Lifecycle Management: Petición GET síncrona (solo lectura).
# doGet → request.user ≡ req.getUserPrincipal() (usuario autenticado en sesión).
#         Response(serializer.data) ≡ resp.getWriter().write(json).
@api_view(['GET', 'DELETE'])
@permission_classes([IsAuthenticated])
def perfil(request):
    """
    Controlador para consultar o eliminar el perfil del usuario autenticado.
    """
    if request.method == 'DELETE':
        user = request.user
        # Se elimina el usuario; por la configuración en cascada de Django, 
        # esto también eliminará sus vehículos, reservas, etc.
        user.delete()
        return Response({'mensaje': 'Cuenta eliminada exitosamente'}, status=status.HTTP_200_OK)

    serializer = UsuarioSerializer(request.user)
    return Response(serializer.data)


# -----------------------------------------------------------------------------
# Debug helpers (temporal) — permiten verificar desde el cliente móvil qué
# usuario y cabeceras llegan al backend. Elimina estos endpoints antes de
# mover a producción.
# -----------------------------------------------------------------------------
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def whoami(request):
    """
    Retorna información básica del usuario autenticado y presencia de header
    Authorization. Útil para comprobar desde la app móvil qué token está
    siendo enviado.
    """
    usuario = request.user
    auth = request.META.get('HTTP_AUTHORIZATION', '')
    masked = ''
    if auth.startswith('Bearer '):
        token = auth.split(' ', 1)[1]
        # Mostrar sólo 8 primeros y 8 últimos caracteres para depuración
        masked = f"{token[:8]}...{token[-8:]}"
    return Response({
        'user_id': getattr(usuario, 'id', None),
        'correo': getattr(usuario, 'correo', getattr(usuario, 'email', None)),
        'auth_header_present': bool(auth),
        'auth_header_masked': masked,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def debug_echo(request):
    """
    Echo del body y algunas cabeceras para depuración de peticiones (p.ej. la
    petición de cancelar reserva enviada desde la app). Requiere autenticación
    para evitar exposición pública.
    """
    usuario = request.user
    auth = request.META.get('HTTP_AUTHORIZATION', '')
    return Response({
        'user_id': getattr(usuario, 'id', None),
        'correo': getattr(usuario, 'correo', getattr(usuario, 'email', None)),
        'auth_header_present': bool(auth),
        'body': request.data,
        'headers_sample': {
            'User-Agent': request.META.get('HTTP_USER_AGENT'),
            'Content-Type': request.META.get('CONTENT_TYPE'),
        }
    })


# ─── RECUPERAR CONTRASEÑA (FLUJO CÓDIGO EMAIL) ────────────────────
import random
from django.core.mail import send_mail
from .models import CodigoRecuperacion

# [ARCHITECTURE_MAPPING]: Servlet-Equivalent
# Role: HttpServlet Controller — Servlet de Envío de Código de Recuperación
# doPost → request.data.get('email') ≡ req.getParameter("email").
#          Genera token de recuperación y llama send_mail (≡ JavaMailSender).
@api_view(['POST'])
@permission_classes([AllowAny])
def enviar_codigo_recuperacion(request):
    """
    Envía un código de recuperación de contraseña al correo del usuario.
    """
    correo = request.data.get('email') or request.data.get('correo')
    if not correo:
        return Response({'error': 'El correo es requerido'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        usuario = Usuario.objects.get(correo=correo)
    except Usuario.DoesNotExist:
        # Por seguridad no revelar si existe o no, pero acá devolvemos error genérico.
        return Response({'error': 'Usuario no encontrado'}, status=status.HTTP_404_NOT_FOUND)

    # Inactivar códigos anteriores
    CodigoRecuperacion.objects.filter(usuario=usuario, usado=False).update(usado=True)

    # Generar código de 6 dígitos
    codigo = str(random.randint(100000, 999999))
    CodigoRecuperacion.objects.create(usuario=usuario, codigo=codigo)

    # Enviar correo (en modo consola localmente)
    send_mail(
        subject='Código de Recuperación de Contraseña - DivinePark',
        message=f'Tu código de recuperación es: {codigo}\n\nEste código es válido por 15 minutos.',
        from_email='no-reply@divinepark.com',
        recipient_list=[correo],
        fail_silently=False,
    )

    return Response({'mensaje': 'Código enviado al correo electrónico'})


# [ARCHITECTURE_MAPPING]: Servlet-Equivalent
# Role: HttpServlet Controller — Servlet de Verificación de Código OTP
# doPost → Valida token temporal (≡ HttpSession.getAttribute("codigo")).
@api_view(['POST'])
@permission_classes([AllowAny])
def verificar_codigo(request):
    """
    Verifica la validez del código de recuperación (OTP) enviado al usuario.
    """
    correo = request.data.get('email') or request.data.get('correo')
    codigo = request.data.get('code') or request.data.get('codigo')

    if not correo or not codigo:
        return Response({'error': 'Correo y código son requeridos'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        usuario = Usuario.objects.get(correo=correo)
        codigo_obj = CodigoRecuperacion.objects.filter(usuario=usuario, codigo=codigo).latest('creado_en')
        
        if not codigo_obj.es_valido():
            return Response({'error': 'Código inválido o expirado'}, status=status.HTTP_400_BAD_REQUEST)
            
        return Response({'mensaje': 'Código verificado exitosamente'})
        
    except (Usuario.DoesNotExist, CodigoRecuperacion.DoesNotExist):
        return Response({'error': 'Código inválido'}, status=status.HTTP_400_BAD_REQUEST)


# [ARCHITECTURE_MAPPING]: Servlet-Equivalent
# Role: HttpServlet Controller — Servlet de Restablecimiento de Contraseña
# doPost → Valida código + nueva contraseña. Persiste cambio en BD (≡ EntityManager.persist()).
@api_view(['POST'])
@permission_classes([AllowAny])
def restablecer_password(request):
    """
    Restablece la contraseña del usuario utilizando el código de recuperación validado.
    """
    correo = request.data.get('email') or request.data.get('correo')
    codigo = request.data.get('code') or request.data.get('codigo')
    nuevo_password = request.data.get('newPassword') or request.data.get('password_nuevo')

    if not all([correo, codigo, nuevo_password]):
        return Response({'error': 'Correo, código y nueva contraseña son requeridos'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        usuario = Usuario.objects.get(correo=correo)
        codigo_obj = CodigoRecuperacion.objects.filter(usuario=usuario, codigo=codigo).latest('creado_en')
        
        if not codigo_obj.es_valido():
            return Response({'error': 'Código inválido o expirado'}, status=status.HTTP_400_BAD_REQUEST)

        # Cambiar contraseña
        usuario.set_password(nuevo_password)
        usuario.save()

        # Marcar código como usado
        codigo_obj.usado = True
        codigo_obj.save()

        return Response({'mensaje': 'Contraseña restablecida exitosamente'})
        
    except (Usuario.DoesNotExist, CodigoRecuperacion.DoesNotExist):
        return Response({'error': 'Código inválido'}, status=status.HTTP_400_BAD_REQUEST)



# ─── CAMBIAR CONTRASEÑA ───────────────────────────────────────────
# [ARCHITECTURE_MAPPING]: Servlet-Equivalent
# Role: HttpServlet Controller — Servlet de Cambio de Contraseña Autenticado
# doPost → request.user.check_password() ≡ validación de credencial de sesión activa.
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def cambiar_password(request):
    """
    Permite a un usuario autenticado cambiar su contraseña actual por una nueva.
    """
    serializer = CambiarPasswordSerializer(data=request.data)
    if serializer.is_valid():
        usuario = request.user
        if not usuario.check_password(serializer.validated_data['password_actual']):
            return Response({'error': 'Contraseña actual incorrecta'}, status=status.HTTP_400_BAD_REQUEST)
        usuario.set_password(serializer.validated_data['password_nuevo'])
        usuario.save()
        return Response({'mensaje': 'Contraseña actualizada exitosamente'})
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# ─── LOGOUT ───────────────────────────────────────────────────────
# [ARCHITECTURE_MAPPING]: Servlet-Equivalent
# Role: HttpServlet Controller — Servlet de Cierre de Sesión
# doPost → token.blacklist() ≡ session.invalidate() en Java Servlet.
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout(request):
    """
    Invalida el token de sesión actual para cerrar la sesión del usuario de forma segura.
    """
    try:
        refresh_token = request.data.get('refresh')
        token = RefreshToken(refresh_token)
        token.blacklist()
        return Response({'mensaje': 'Sesión cerrada exitosamente'})
    except Exception:
        return Response({'error': 'Token inválido'}, status=status.HTTP_400_BAD_REQUEST)


# ─── VIEWSETS DE NEGOCIO ──────────────────────────────────────────

from rest_framework import viewsets
from rest_framework.decorators import action
from django.utils import timezone
from .models import (
    Vehiculo, EspacioParqueo, Sensor, Tarifa, Reserva,
    SesionParqueo, Pago, EventoAcceso, AutorizacionExcepcional,
    CamaraOCR, LecturaOCR, Barrera, Notificacion, Reporte,
    Billetera, Recarga
)
from .serializers import (
    VehiculoSerializer, EspacioParqueoSerializer, SensorSerializer,
    TarifaSerializer, ReservaSerializer, SesionParqueoSerializer,
    PagoSerializer, EventoAccesoSerializer, AutorizacionExcepcionalSerializer,
    CamaraOCRSerializer, LecturaOCRSerializer, BarreraSerializer,
    NotificacionSerializer, ReporteSerializer,
    BilleteraSerializer, RecargaSerializer
)
from .permissions import IsAdministrador, IsOperador, IsConductor, IsAdministradorOrReadOnly, IsOperadorOrAdministrador


# [ARCHITECTURE_MAPPING]: Servlet-Equivalent
# Role: HttpServlet Controller — VehiculoServlet (CRUD de Vehículos)
# Lifecycle Management: Peticiones síncronas GET/POST/PUT/DELETE mediante métodos de instancia.
# doGet  → list() / retrieve()  — Consulta de vehículos (≡ doGet con SELECT)
# doPost → create()             — Registro de vehículo (≡ doPost con INSERT)
# doPut  → update()             — Actualización (≡ doPut con UPDATE)
# doDelete → destroy()          — Eliminación (≡ doDelete con DELETE)
class VehiculoViewSet(viewsets.ModelViewSet):
    """
    ViewSet para la gestión completa (CRUD) de los vehículos registrados.
    """
    queryset = Vehiculo.objects.all()
    serializer_class = VehiculoSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """
        Retorna el listado de vehículos disponibles dependiendo del rol del usuario.
        """
        # Los administradores y operadores pueden ver todos, conductores solo los suyos
        user = self.request.user
        if self.request.query_params.get('all') == 'true' and hasattr(user, 'rol') and user.rol in ['administrador', 'operador']:
            return Vehiculo.objects.all()
        return Vehiculo.objects.filter(usuario=user)

    def perform_create(self, serializer):
        """
        Asocia el nuevo vehículo creado al usuario que realiza la petición HTTP.
        """
        serializer.save(usuario=self.request.user)

    from rest_framework.decorators import action
    from rest_framework.response import Response

    @action(detail=False, methods=['get'])
    def tipos(self, request):
        """
        Retorna los tipos de vehículos definidos en la base de datos.
        """
        tipos_list = [{'id': k, 'nombre': v} for k, v in Vehiculo.TIPO_CHOICES]
        return Response(tipos_list)



# [ARCHITECTURE_MAPPING]: Servlet-Equivalent
# Role: HttpServlet Controller — EspacioParqueoServlet
# doGet → Consulta disponibilidad de espacios (≡ doGet con SELECT + filtro de estado).
# doPost/doPut → Reserva o actualiza estado de espacio (libre/ocupado/mantenimiento).
class EspacioParqueoViewSet(viewsets.ModelViewSet):
    """
    ViewSet para consultar y administrar la disponibilidad de los espacios de parqueo.
    """
    queryset = EspacioParqueo.objects.all()
    serializer_class = EspacioParqueoSerializer
    permission_classes = [IsAdministradorOrReadOnly]

    from rest_framework.decorators import action
    @action(detail=False, methods=['get'])
    def disponibles(self, request):
        """
        Retorna los espacios que no tienen una reserva activa que se solape con el rango dado.
        """
        inicio_str = request.query_params.get('inicio')
        fin_str = request.query_params.get('fin')
        
        if not inicio_str or not fin_str:
            from rest_framework.response import Response
            from rest_framework import status
            return Response({'error': 'Faltan parámetros inicio y fin'}, status=status.HTTP_400_BAD_REQUEST)
            
        from django.utils.dateparse import parse_datetime
        from datetime import timedelta
        from django.utils import timezone
        
        try:
            inicio = parse_datetime(inicio_str)
            if inicio and timezone.is_naive(inicio):
                inicio = timezone.make_aware(inicio)
            
            fin = parse_datetime(fin_str)
            if fin and timezone.is_naive(fin):
                fin = timezone.make_aware(fin)
                
            if not inicio or not fin:
                raise ValueError("Fecha no válida")
        except Exception:
            from rest_framework.response import Response
            from rest_framework import status
            return Response({'error': 'Formato de fecha inválido'}, status=status.HTTP_400_BAD_REQUEST)
            
        margen = timedelta(minutes=15)
        inicio_con_margen = inicio - margen
        fin_con_margen = fin + margen
        
        try:
            from .models import Reserva
            espacios_solapados = Reserva.objects.filter(
                estado='activa',
                fecha_inicio__lt=fin_con_margen,
                fecha_fin__gt=inicio_con_margen
            ).values_list('espacio_id', flat=True)
            
            espacios_libres = self.queryset.exclude(id__in=list(espacios_solapados)).exclude(estado__in=['ocupado', 'mantenimiento'])
            serializer = self.get_serializer(espacios_libres, many=True)
            
            from rest_framework.response import Response
            return Response(serializer.data)
        except Exception as e:
            import traceback
            traceback.print_exc()
            from rest_framework.response import Response
            from rest_framework import status
            return Response({'error': str(e), 'trace': traceback.format_exc()}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# [ARCHITECTURE_MAPPING]: Servlet-Equivalent
# Role: HttpServlet Controller — SensorServlet (Gestión de Sensores IoT)
# doGet  → Lista sensores y estado (≡ doGet + resp.setContentType("application/json")).
# doPost → Registra nuevo sensor (≡ doPost + INSERT en BD).
class SensorViewSet(viewsets.ModelViewSet):
    """
    ViewSet para la administración y monitoreo de los sensores IoT instalados.
    """
    queryset = Sensor.objects.all()
    serializer_class = SensorSerializer
    permission_classes = [IsAdministradorOrReadOnly]


# [ARCHITECTURE_MAPPING]: Servlet-Equivalent
# Role: HttpServlet Controller — TarifaServlet
# doGet  → Consulta tarifas activas (≡ doGet con SELECT WHERE activa=TRUE).
# doPost → Crea nueva tarifa por hora (≡ doPost + INSERT).
class TarifaViewSet(viewsets.ModelViewSet):
    """
    ViewSet para definir y consultar las tarifas aplicables al servicio de parqueo.
    """
    queryset = Tarifa.objects.all()
    serializer_class = TarifaSerializer
    permission_classes = [IsAdministradorOrReadOnly]


# [ARCHITECTURE_MAPPING]: Servlet-Equivalent
# Role: HttpServlet Controller — ReservaServlet
# doPost → Crea reserva de espacio (≡ doPost + INSERT + session tracking).
# doGet  → Lista reservas del usuario (≡ doGet filtrado por req.getUserPrincipal()).
class ReservaViewSet(viewsets.ModelViewSet):
    """
    ViewSet para la gestión de reservas de espacios de parqueo por parte de los usuarios.
    """
    queryset = Reserva.objects.all()
    serializer_class = ReservaSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """
        Retorna el listado de reservas disponibles dependiendo del usuario.
        """
        user = self.request.user
        if self.request.query_params.get('all') == 'true' and hasattr(user, 'rol') and user.rol in ['administrador', 'operador']:
            return Reserva.objects.all()
        return Reserva.objects.filter(usuario=user)

    def perform_create(self, serializer):
        """
        Guarda la reserva en la base de datos validando los horarios y disponibilidad.
        """
        serializer.save()

    def destroy(self, request, *args, **kwargs):
        # Logging temporal para depuración de cancelaciones desde cliente móvil
        logger = logging.getLogger(__name__)
        usuario = request.user
        logger.info(f"Reserva.destroy called - user_id={getattr(usuario,'id',None)} correo={getattr(usuario,'correo',getattr(usuario,'email',None))} kwargs={kwargs} body={request.data}")
        return super().destroy(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        # Capturar intentos de actualizar estado (p.ej. cancelar)
        logger = logging.getLogger(__name__)
        usuario = request.user
        estado = request.data.get('estado')
        logger.info(f"Reserva.partial_update called - user_id={getattr(usuario,'id',None)} correo={getattr(usuario,'correo',getattr(usuario,'email',None))} estado={estado} body={request.data}")
        return super().partial_update(request, *args, **kwargs)


# [ARCHITECTURE_MAPPING]: Servlet-Equivalent
# Role: HttpServlet Controller — SesionParqueoServlet (Control de Acceso Vehicular)
# Lifecycle Management: Ciclo de vida completo de sesión de parqueo (apertura → cierre).
# doPost (entrada-manual) → Registra entrada de vehículo, actualiza espacio y crea EventoAcceso.
# doPost (salida-manual)  → Cierra sesión, calcula duración y genera Pago pendiente.
# El objeto `request` transporta placa, espacio_id y token de autorización del operador,
# equivalente al HttpServletRequest que transporta parámetros de formulario + JSESSIONID.
class SesionParqueoViewSet(viewsets.ModelViewSet):
    """
    ViewSet para administrar las sesiones activas de parqueo de los vehículos en tiempo real.
    """
    queryset = SesionParqueo.objects.all()
    serializer_class = SesionParqueoSerializer
    permission_classes = [IsOperadorOrAdministrador]

    @action(detail=False, methods=['post'], url_path='validar-entrada')
    def validar_entrada(self, request):
        """
        Verifica si una placa tiene reserva activa y retorna los datos del vehículo y espacio.
        """
        placa = request.data.get('placa')
        if not placa:
            return Response({'error': 'Placa es requerida'}, status=status.HTTP_400_BAD_REQUEST)
        
        from django.utils import timezone
        from datetime import timedelta
        from django.db.models import Value
        from django.db.models.functions import Replace

        ahora = timezone.now()
        margen = timedelta(minutes=30)
        placa_limpia_input = placa.replace('-', '').replace(' ', '').upper()

        reserva_activa = Reserva.objects.annotate(
            placa_db=Replace('vehiculo__placa', Value('-'), Value('')),
            placa_db_clean=Replace('placa_db', Value(' '), Value(''))
        ).filter(
            placa_db_clean__iexact=placa_limpia_input,
            estado='activa',
            fecha_inicio__lte=ahora + margen,
            fecha_fin__gte=ahora - margen
        ).first()

        if not reserva_activa:
            return Response({'error': 'No hay reserva activa para esta placa en este horario.'}, status=status.HTTP_404_NOT_FOUND)
        
        vehiculo = reserva_activa.vehiculo
        espacio = reserva_activa.espacio
        
        return Response({
            'valido': True,
            'reserva_id': reserva_activa.id,
            'vehiculo': {
                'id': vehiculo.id,
                'placa': vehiculo.placa,
                'marca': vehiculo.marca,
                'modelo': vehiculo.modelo,
                'color': vehiculo.color,
                'tipo': vehiculo.tipo
            },
            'espacio': {
                'id': espacio.id,
                'zona': espacio.zona,
                'numero': espacio.numero
            },
            'usuario': reserva_activa.usuario.nombre
        })

    @action(detail=False, methods=['post'], url_path='entrada-manual')
    def entrada_manual(self, request):
        """
        Registra de forma manual la entrada de un vehículo al parqueadero.
        """
        placa = request.data.get('placa')
        tipo = request.data.get('tipo', 'carro')
        espacio_id = request.data.get('espacio_id')

        if not placa or not espacio_id:
            return Response({'error': 'Placa y espacio_id son requeridos'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            espacio = EspacioParqueo.objects.get(id=espacio_id)
        except EspacioParqueo.DoesNotExist:
            return Response({'error': 'Espacio no encontrado'}, status=status.HTTP_404_NOT_FOUND)

        if espacio.estado != 'libre':
            return Response({'error': 'El espacio no está libre'}, status=status.HTTP_400_BAD_REQUEST)

        from django.utils import timezone
        from datetime import timedelta
        
        from django.db.models import Value
        from django.db.models.functions import Replace

        ahora = timezone.now()
        margen = timedelta(minutes=30)
        
        placa_limpia_input = placa.replace('-', '').replace(' ', '').upper()

        # Verificar si existe una reserva activa para esa placa (ignorando guiones/espacios)
        reserva_activa = Reserva.objects.annotate(
            placa_db=Replace('vehiculo__placa', Value('-'), Value('')),
            placa_db_clean=Replace('placa_db', Value(' '), Value(''))
        ).filter(
            placa_db_clean__iexact=placa_limpia_input,
            estado='activa',
            fecha_inicio__lte=ahora + margen,
            fecha_fin__gte=ahora - margen
        ).first()

        if not reserva_activa:
            return Response({'error': 'Ingreso denegado: El vehículo no tiene una reserva activa en este horario o la placa no coincide.'}, status=status.HTTP_400_BAD_REQUEST)

        # Si tiene reserva, obtenemos el vehículo (ya sabemos que existe)
        vehiculo = reserva_activa.vehiculo


        
        sesion = SesionParqueo.objects.create(
            vehiculo=vehiculo,
            espacio=espacio,
            hora_inicio=timezone.now(),
            estado_sesion='abierta'
        )

        espacio.estado = 'ocupado'
        espacio.save()

        EventoAcceso.objects.create(
            vehiculo=vehiculo,
            operador=request.user,
            sesion=sesion,
            espacio=espacio,
            tipo_evento='entrada',
            placa_detectada=placa,
            es_manual=True
        )

        return Response({
            'mensaje': f'Entrada manual registrada en Zona {espacio.zona} — Espacio #{espacio.numero}',
            'sesion': SesionParqueoSerializer(sesion).data,
            'espacio_codigo': f'{espacio.zona}-{str(espacio.numero).zfill(2)}'
        }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='salida-manual')
    def salida_manual(self, request, pk=None):
        """
        Registra de forma manual la salida de un vehículo y genera el cobro correspondiente.
        """
        sesion = self.get_object()
        if sesion.estado_sesion != 'abierta':
            return Response({'error': 'La sesión ya está cerrada'}, status=status.HTTP_400_BAD_REQUEST)

        sesion.hora_fin = timezone.now()
        duracion = sesion.hora_fin - sesion.hora_inicio
        sesion.duracion_min = int(duracion.total_seconds() // 60)
        sesion.estado_sesion = 'cerrada'
        sesion.save()

        espacio = sesion.espacio
        espacio.estado = 'libre'
        espacio.save()

        EventoAcceso.objects.create(
            vehiculo=sesion.vehiculo,
            operador=request.user,
            sesion=sesion,
            espacio=espacio,
            tipo_evento='salida',
            placa_detectada=sesion.vehiculo.placa,
            es_manual=True
        )

        tarifa_activa = Tarifa.objects.filter(activa=True).first()
        monto = 0
        if tarifa_activa:
            horas = max(1, (sesion.duracion_min // 60) + (1 if sesion.duracion_min % 60 > 0 else 0))
            monto = horas * tarifa_activa.valor_hora

        pago = Pago.objects.create(
            sesion=sesion,
            tarifa=tarifa_activa,
            monto=monto,
            metodo='excepcion',
            estado_pago='pendiente'
        )

        return Response({
            'mensaje': 'Salida manual registrada exitosamente',
            'sesion': SesionParqueoSerializer(sesion).data,
            'pago': PagoSerializer(pago).data
        }, status=status.HTTP_200_OK)


# [ARCHITECTURE_MAPPING]: Servlet-Equivalent
# Role: HttpServlet Controller — PagoServlet (Procesamiento de Cobros)
# doPost → Registra pago (≡ doPost + transacción en BD).
# doGet  → Historial de pagos (≡ doGet + consulta BD + respuesta JSON).
class PagoViewSet(viewsets.ModelViewSet):
    """
    ViewSet para la administración del historial de pagos y cobros registrados.
    """
    queryset = Pago.objects.all()
    serializer_class = PagoSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        from rest_framework.exceptions import ValidationError
        from django.db import transaction
        from .models import Billetera

        # Logging temporal para depuración: registra qué usuario y token
        logger = logging.getLogger(__name__)
        usuario = getattr(self.request, 'user', None)
        user_id = getattr(usuario, 'id', None)
        user_correo = getattr(usuario, 'correo', getattr(usuario, 'email', None))
        auth_header = self.request.META.get('HTTP_AUTHORIZATION', '')
        logger.info(f"Pago.perform_create called - user_id={user_id} correo={user_correo} metodo_field={serializer.initial_data.get('metodo')} monto_field={serializer.initial_data.get('monto')} AuthorizationHeaderPresent={'Bearer' in auth_header}")

        monto = serializer.validated_data.get('monto', 0)
        metodo = serializer.validated_data.get('metodo', '')

        with transaction.atomic():
            if metodo == 'app':
                billetera, _ = Billetera.objects.get_or_create(usuario=self.request.user)
                if billetera.saldo < monto:
                    raise ValidationError("Saldo insuficiente en la billetera.")
                billetera.saldo -= monto
                billetera.save()
            serializer.save()

    @action(detail=True, methods=['get'], permission_classes=[AllowAny])
    def factura(self, request, pk=None):
        """
        Genera una vista en HTML simulando una factura descargable en PDF.
        """
        from django.http import HttpResponse
        pago = self.get_object()
        
        # Recuperar placa y usuario para mostrar en la factura
        vehiculo_placa = 'N/A'
        usuario_nombre = 'N/A'
        if getattr(pago, 'reserva', None):
            if pago.reserva.vehiculo:
                vehiculo_placa = pago.reserva.vehiculo.placa
            if pago.reserva.usuario:
                usuario_nombre = getattr(pago.reserva.usuario, 'nombre', getattr(pago.reserva.usuario, 'email', 'N/A'))
        elif getattr(pago, 'sesion', None):
            if pago.sesion.vehiculo:
                vehiculo_placa = pago.sesion.vehiculo.placa
            if pago.sesion.usuario:
                usuario_nombre = getattr(pago.sesion.usuario, 'nombre', getattr(pago.sesion.usuario, 'email', 'N/A'))

        html = f"""
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <title>Factura PX-{pago.id:04d}</title>
            <style>
                body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; max-width: 600px; margin: 0 auto; color: #334155; }}
                h1 {{ color: #1e293b; margin-bottom: 5px; }}
                h2 {{ color: #64748b; font-size: 16px; margin-top: 0; font-weight: normal; }}
                .invoice-header {{ border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 20px; }}
                .detail-row {{ display: flex; justify-content: space-between; margin-bottom: 10px; border-bottom: 1px solid #f1f5f9; padding-bottom: 8px; }}
                .total-row {{ display: flex; justify-content: space-between; margin-top: 20px; font-size: 18px; font-weight: bold; color: #0f172a; }}
                .badge {{ padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; text-transform: uppercase; }}
                .badge-aprobado {{ background: #22c55e; color: white; }}
                .badge-pendiente {{ background: #facc15; color: white; }}
                .badge-rechazado {{ background: #ef4444; color: white; }}
                .footer {{ margin-top: 40px; text-align: center; color: #94a3b8; font-size: 14px; border-top: 1px solid #e2e8f0; padding-top: 20px; }}
                @media print {{
                    @page {{ margin: 0; }}
                    body {{ padding: 2cm; max-width: 100%; }}
                }}
            </style>
        </head>
        <body>
            <div class="invoice-header">
                <h1>Divine Park</h1>
                <h2>Soluciones de Estacionamiento Inteligente</h2>
            </div>
            
            <div class="detail-row">
                <span><strong>No. de Factura:</strong></span>
                <span>#PX-{pago.id:04d}</span>
            </div>
            <div class="detail-row">
                <span><strong>Fecha:</strong></span>
                <span>{pago.fecha.strftime('%d/%m/%Y %I:%M %p')}</span>
            </div>
            <div class="detail-row">
                <span><strong>Usuario:</strong></span>
                <span>{usuario_nombre}</span>
            </div>
            <div class="detail-row">
                <span><strong>Vehículo (Placa):</strong></span>
                <span>{vehiculo_placa}</span>
            </div>
            <div class="detail-row">
                <span><strong>Método de pago:</strong></span>
                <span style="text-transform: capitalize;">{pago.metodo}</span>
            </div>
            <div class="detail-row">
                <span><strong>Estado:</strong></span>
                <span class="badge badge-{pago.estado_pago}">{pago.estado_pago}</span>
            </div>
            
            <div class="total-row">
                <span>Monto Total:</span>
                <span>${pago.monto} COP</span>
            </div>
            
            <div class="footer">
                <p>Gracias por utilizar nuestros servicios.</p>
                <p><small>Este documento es generado automáticamente y sirve como comprobante de pago electrónico.</small></p>
            </div>
            
            <script>
                // Opcional: abrir el diálogo de impresión automáticamente al abrir el enlace
                setTimeout(function() {{ window.print(); }}, 500);
            </script>
        </body>
        </html>
        """
        return HttpResponse(html)


# [ARCHITECTURE_MAPPING]: Servlet-Equivalent
# Role: HttpServlet Controller — EventoAccesoServlet (Log de Accesos, Solo Lectura)
# doGet → Lista de eventos de entrada/salida (≡ doGet con SELECT + ORDER BY fecha DESC).
class EventoAccesoViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet de solo lectura para visualizar el historial de eventos de acceso (entradas y salidas).
    """
    queryset = EventoAcceso.objects.all()
    serializer_class = EventoAccesoSerializer
    permission_classes = [IsOperadorOrAdministrador]


# [ARCHITECTURE_MAPPING]: Servlet-Equivalent
# Role: HttpServlet Controller — AutorizacionExcepcionalServlet
# doPost → perform_create() ≡ doPost que asigna automáticamente operador=request.user
#           (≡ req.getUserPrincipal() asignado a la entidad antes del INSERT).
class AutorizacionExcepcionalViewSet(viewsets.ModelViewSet):
    """
    ViewSet para la gestión de autorizaciones excepcionales de acceso al parqueadero.
    """
    queryset = AutorizacionExcepcional.objects.all()
    serializer_class = AutorizacionExcepcionalSerializer
    permission_classes = [IsOperadorOrAdministrador]

    def perform_create(self, serializer):
        """
        Asocia automáticamente el operador en sesión a la autorización excepcional creada.
        """
        serializer.save(operador=self.request.user)


# [ARCHITECTURE_MAPPING]: Servlet-Equivalent
# Role: HttpServlet Controller — CamaraOCRServlet (Gestión de Cámaras IoT)
# doGet/doPost → Administra configuración y estado de cámaras de reconocimiento de placas.
class CamaraOCRViewSet(viewsets.ModelViewSet):
    """
    ViewSet para configurar y consultar el estado operativo de las cámaras OCR.
    """
    queryset = CamaraOCR.objects.all()
    serializer_class = CamaraOCRSerializer
    permission_classes = [IsOperadorOrAdministrador]


# [ARCHITECTURE_MAPPING]: Servlet-Equivalent
# Role: HttpServlet Controller — LecturaOCRServlet (Solo Lectura)
# doGet → Devuelve lecturas OCR de placas detectadas por cámaras.
class LecturaOCRViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet de solo lectura para el registro de placas detectadas por las cámaras.
    """
    queryset = LecturaOCR.objects.all()
    serializer_class = LecturaOCRSerializer
    permission_classes = [IsOperadorOrAdministrador]


# [ARCHITECTURE_MAPPING]: Servlet-Equivalent
# Role: HttpServlet Controller — BarreraServlet (Control de Barreras Físicas)
# doPost → Cambia estado de barrera (abierta/cerrada) (≡ doPost con comando a dispositivo IoT).
# doGet  → Consulta estado actual de barreras de entrada/salida.
class BarreraViewSet(viewsets.ModelViewSet):
    """
    ViewSet para controlar y monitorizar las barreras de acceso físicas.
    """
    queryset = Barrera.objects.all()
    serializer_class = BarreraSerializer
    permission_classes = [IsOperadorOrAdministrador]


# [ARCHITECTURE_MAPPING]: Servlet-Equivalent
# Role: HttpServlet Controller — NotificacionServlet (Alertas del Sistema)
# doGet → get_queryset() filtra por rol (≡ doGet con SELECT según req.isUserInRole()).
class NotificacionViewSet(viewsets.ModelViewSet):
    """
    ViewSet para la administración y envío de notificaciones o alertas a los usuarios.
    """
    queryset = Notificacion.objects.all()
    serializer_class = NotificacionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """
        Filtra las notificaciones a mostrar según el rol del usuario autenticado.
        """
        # Operadores y administradores ven todas las alertas de sistema
        usuario = self.request.user
        if hasattr(usuario, 'rol') and usuario.rol in ['operador', 'administrador']:
            return Notificacion.objects.all().order_by('-fecha')
        return Notificacion.objects.filter(usuario=self.request.user).order_by('-fecha')


# [ARCHITECTURE_MAPPING]: Servlet-Equivalent
# Role: HttpServlet Controller — ReporteServlet (Generación de Reportes)
# doGet  → Descarga de reportes en formato JSON (≡ doGet + resp.setContentType("application/pdf")).
# doPost → Solicita generación de nuevo reporte (≡ doPost + tarea asíncrona).
class ReporteViewSet(viewsets.ModelViewSet):
    """
    ViewSet para la generación y consulta de reportes del sistema.
    """
    queryset = Reporte.objects.all()
    serializer_class = ReporteSerializer
    permission_classes = [IsAdministrador]


# [ARCHITECTURE_MAPPING]: Servlet-Equivalent
# Role: HttpServlet Controller — UsuarioServlet (Administración de Usuarios)
# doGet  → Lista todos los usuarios del sistema (≡ doGet con SELECT *).
# doPost (activar/desactivar) → Cambia estado de cuenta (≡ doPost con UPDATE estado=TRUE/FALSE).
class UsuarioViewSet(viewsets.ModelViewSet):
    """
    ViewSet para la administración centralizada de cuentas de usuario.
    """
    queryset = Usuario.objects.all()
    serializer_class = UsuarioSerializer
    permission_classes = [IsAdministrador]

    @action(detail=True, methods=['post'], url_path='activar')
    def activar(self, request, pk=None):
        """
        Habilita y activa la cuenta de un usuario en el sistema.
        """
        user = self.get_object()
        user.estado = True
        user.save()
        return Response({'status': 'activado'})

    @action(detail=True, methods=['post'], url_path='desactivar')
    def desactivar(self, request, pk=None):
        """
        Deshabilita y restringe el acceso de una cuenta de usuario.
        """
        user = self.get_object()
        user.estado = False
        user.save()
        return Response({'status': 'desactivado'})


# [ARCHITECTURE_MAPPING]: Servlet-Equivalent
# Role: HttpServlet Controller — EstadisticasServlet (Dashboard Analítico)
# Lifecycle Management: Servlet de solo lectura (READ-ONLY) que agrega métricas en tiempo real.
# doGet (tablero)      → KPIs de ocupación, ingresos y estado de hardware.
# doGet (ventas)       → Estadísticas de ventas del mes con detalle diario.
# doGet (alertas_tiempo) → Infracciones por sobretiempo en sesiones activas.
# El ViewSet hereda de ViewSet (≡ HttpServlet) y solo expone acciones GET (≡ doGet).
class EstadisticasViewSet(viewsets.ViewSet):
    """
    ViewSet de solo lectura con endpoints para dashboard y reportes analíticos.
    """
    permission_classes = [IsOperadorOrAdministrador]

    @action(detail=False, methods=['get'])
    def tablero(self, request):
        """
        Retorna las métricas principales para el tablero de control en tiempo real.
        """
        total_espacios = EspacioParqueo.objects.count()
        espacios_ocupados = EspacioParqueo.objects.filter(estado='ocupado').count()
        espacios_libres = EspacioParqueo.objects.filter(estado='libre').count()

        hoy = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)
        pagos_hoy = Pago.objects.filter(fecha__gte=hoy, estado_pago='aprobado')
        ingresos_hoy = sum(p.monto for p in pagos_hoy)

        # Sensores
        total_sensores = Sensor.objects.count()
        sensores_activos = Sensor.objects.filter(estado_sensor=True).exclude(espacio__estado='mantenimiento').count()

        # Cámaras OCR
        camaras_activas = CamaraOCR.objects.filter(activa=True).count()

        # Barreras
        from .serializers import BarreraSerializer
        barreras = Barrera.objects.all()
        barrera_entrada = barreras.filter(ubicacion__icontains='entrada').first()
        barrera_salida = barreras.filter(ubicacion__icontains='salida').first()

        return Response({
            'plazas_totales': total_espacios,
            'plazas_disponibles': espacios_libres,
            'plazas_ocupadas': espacios_ocupados,
            'ingresos_hoy': float(ingresos_hoy),
            'sensores_total': total_sensores,
            'sensores_activos': sensores_activos,
            'camaras_activas': camaras_activas,
            'barrera_entrada_estado': barrera_entrada.estado if barrera_entrada else None,
            'barrera_salida_estado': barrera_salida.estado if barrera_salida else None,
        })

    @action(detail=False, methods=['get'])
    def ventas(self, request):
        """
        Devuelve las estadísticas y el historial de ventas consolidado del mes actual.
        """
        from django.db.models import Sum, Count, Avg
        import datetime

        hoy = timezone.now()
        inicio_mes = hoy.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        # KPIs del mes
        pagos_mes = Pago.objects.filter(fecha__gte=inicio_mes, estado_pago='aprobado')
        total_ventas = pagos_mes.aggregate(total=Sum('monto'))['total'] or 0
        total_facturas = pagos_mes.count()
        promedio = pagos_mes.aggregate(prom=Avg('monto'))['prom'] or 0

        # Ocupacion maxima del mes (% de espacios que estuvieron ocupados algun momento)
        total_espacios = EspacioParqueo.objects.count()
        espacios_ocupados = EspacioParqueo.objects.filter(estado='ocupado').count()
        ocupacion_pct = round((espacios_ocupados / total_espacios * 100), 1) if total_espacios > 0 else 0

        # Ventas diarias de los ultimos 7 dias
        ventas_diarias = []
        dias_semana = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
        for i in range(6, -1, -1):
            fecha = (hoy - datetime.timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
            fecha_fin = fecha + datetime.timedelta(days=1)
            total_dia = Pago.objects.filter(
                fecha__gte=fecha, fecha__lt=fecha_fin, estado_pago='aprobado'
            ).aggregate(total=Sum('monto'))['total'] or 0
            ventas_diarias.append({
                'dia': dias_semana[fecha.weekday()],
                'total': float(total_dia)
            })

        # Ultimos 10 pagos
        ultimos_pagos = []
        for p in Pago.objects.select_related('sesion', 'reserva').order_by('-fecha')[:10]:
            ticket_id = f'TK-{p.id:05d}'
            ultimos_pagos.append({
                'id': p.id,
                'ticket_id': ticket_id,
                'fecha': p.fecha.strftime('%d %b %Y'),
                'metodo': p.metodo,
                'estado': p.estado_pago,
                'monto': float(p.monto),
            })

        return Response({
            'total_ventas': float(total_ventas),
            'total_facturas': total_facturas,
            'promedio_venta': float(promedio),
            'ocupacion_maxima': ocupacion_pct,
            'ventas_diarias': ventas_diarias,
            'ultimos_pagos': ultimos_pagos,
        })

    @action(detail=False, methods=['get'])
    def alertas_tiempo(self, request):
        """
        Retorna las entradas y salidas registradas por los operadores (reemplazando el reporte de alertas de tiempo).
        """
        from django.db.models import Count
        from .models import EventoAcceso

        eventos = EventoAcceso.objects.select_related('operador', 'espacio', 'vehiculo').order_by('-fecha_hora')

        total_entradas = eventos.filter(tipo_evento='entrada').count()
        total_salidas = eventos.filter(tipo_evento='salida').count()

        # Operador más activo
        operador_data = eventos.exclude(operador__isnull=True).values('operador__nombre').annotate(total=Count('id')).order_by('-total').first()
        operador_mas_activo = operador_data['operador__nombre'] if operador_data else 'N/A'

        # Lista de accesos
        incidencias = []
        for ev in eventos[:100]:
            placa = ev.vehiculo.placa if ev.vehiculo else ev.placa_detectada
            operador = ev.operador.nombre if ev.operador else 'Automático (LPR)'
            zona = f"Zona {ev.espacio.zona}" if ev.espacio else 'N/A'
            incidencias.append({
                'fecha': ev.fecha_hora.strftime('%d %b %Y, %I:%M %p'),
                'placa': placa,
                'ubicacion': zona,
                'tiempo_total': operador,  # Reutilizamos este campo para el Operador
                'estado': ev.tipo_evento.capitalize(), # Reutilizamos este campo para el Tipo de Evento (Entrada/Salida)
            })

        return Response({
            'total_infracciones': total_entradas,
            'promedio_excedido_min': total_salidas,
            'zona_mas_incidencias': operador_mas_activo,
            'incidencias': incidencias,
        })


# ─── BILLETERA ────────────────────────────────────────────────────
# [ARCHITECTURE_MAPPING]: Servlet-Equivalent
# Role: BilleteraServlet — Wallet del conductor
# doGet (mi-billetera) → Retorna o crea la billetera del usuario autenticado.
class BilleteraViewSet(viewsets.ModelViewSet):
    """
    ViewSet para visualizar el estado y transacciones de la billetera del usuario.
    """
    serializer_class = BilleteraSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """
        Retorna la billetera asociada exclusivamente al usuario autenticado.
        """
        return Billetera.objects.filter(usuario=self.request.user)

    @action(detail=False, methods=['get'], url_path='mi-billetera')
    def mi_billetera(self, request):
        """
        Obtiene o crea automáticamente la billetera del usuario actual si no existe.
        """
        billetera, _ = Billetera.objects.get_or_create(usuario=request.user)
        return Response(BilleteraSerializer(billetera).data)

    @action(detail=False, methods=['get'], url_path='mis-facturas')
    def mis_facturas(self, request):
        """
        Devuelve el historial combinado de recargas y pagos realizados por el usuario.
        """
        from django.db.models import Q
        billetera, _ = Billetera.objects.get_or_create(usuario=request.user)
        
        # Obtener Recargas
        recargas = Recarga.objects.filter(billetera=billetera).order_by('-fecha')
        
        # Obtener Pagos de Reservas del usuario
        pagos = Pago.objects.filter(reserva__usuario=request.user).order_by('-fecha')
        
        facturas = []
        for r in recargas:
            facturas.append({
                'id': f'R-{r.id}',
                'fecha': r.fecha.isoformat() if r.fecha else None,
                'monto': r.monto,
                'metodo': r.metodo,
                'metodo_display': dict(Recarga.METODO_CHOICES).get(r.metodo, r.metodo),
                'estado': r.estado,
                'estado_display': dict(Recarga.ESTADO_CHOICES).get(r.estado, r.estado),
                'tipo': 'Recarga de Saldo',
            })
            
        for p in pagos:
            facturas.append({
                'id': f'P-{p.id}',
                'fecha': p.fecha.isoformat() if p.fecha else None,
                'monto': p.monto,
                'metodo': p.metodo,
                'metodo_display': dict(Pago.METODO_CHOICES).get(p.metodo, p.metodo),
                'estado': p.estado_pago,
                'estado_display': dict(Pago.ESTADO_CHOICES).get(p.estado_pago, p.estado_pago),
                'tipo': 'Pago de Reserva',
            })
            
        # Ordenar combinado por fecha descendente
        facturas.sort(key=lambda x: x['fecha'] or '', reverse=True)
        return Response(facturas)


# ─── RECARGA ──────────────────────────────────────────────────────
# [ARCHITECTURE_MAPPING]: Servlet-Equivalent
# Role: RecargaServlet — Recarga de saldo en billetera
# doGet  → Historial de recargas del usuario.
# doPost → Crea recarga y suma saldo a la billetera (transacción atómica).
class RecargaViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gestionar las operaciones de recarga de saldo en las billeteras.
    """
    serializer_class = RecargaSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """
        Retorna el historial de recargas correspondientes a la billetera del usuario.
        """
        billetera, _ = Billetera.objects.get_or_create(usuario=self.request.user)
        return Recarga.objects.filter(billetera=billetera)

    def create(self, request, *args, **kwargs):
        """
        Registra una nueva recarga y actualiza de manera atómica el saldo de la billetera.
        """
        billetera, _ = Billetera.objects.get_or_create(usuario=request.user)
        monto  = request.data.get('monto')
        metodo = request.data.get('metodo', 'otro')

        if not monto:
            return Response({'error': 'El monto es requerido'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            monto = float(monto)
            if monto <= 0:
                raise ValueError
        except (ValueError, TypeError):
            return Response({'error': 'Monto inválido'}, status=status.HTTP_400_BAD_REQUEST)

        recarga = Recarga.objects.create(
            billetera=billetera,
            monto=monto,
            metodo=metodo,
            estado='exitosa'
        )
        # Acreditar saldo
        from decimal import Decimal
        billetera.saldo += Decimal(str(monto))
        billetera.save()

        return Response({
            'mensaje': 'Recarga exitosa',
            'recarga': RecargaSerializer(recarga).data,
            'saldo_actual': str(billetera.saldo),
        }, status=status.HTTP_201_CREATED)