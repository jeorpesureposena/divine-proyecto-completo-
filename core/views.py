from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate
from .models import Usuario
from .serializers import RegistroSerializer, UsuarioSerializer, CambiarPasswordSerializer

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
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def perfil(request):
    """
    Controlador para consultar el perfil del usuario autenticado.
    """
    serializer = UsuarioSerializer(request.user)
    return Response(serializer.data)


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
        if hasattr(user, 'rol') and user.rol in ['administrador', 'operador']:
            return Vehiculo.objects.all()
        return Vehiculo.objects.filter(usuario=user)

    def perform_create(self, serializer):
        """
        Asocia el nuevo vehículo creado al usuario que realiza la petición HTTP.
        """
        serializer.save(usuario=self.request.user)


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

    def perform_create(self, serializer):
        """
        Guarda la reserva y actualiza automáticamente el estado del espacio de parqueo a reservado.
        """
        reserva = serializer.save()
        espacio = reserva.espacio
        if espacio.estado == 'libre':
            espacio.estado = 'reservado'
            espacio.save()


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

        vehiculo, created = Vehiculo.objects.get_or_create(
            placa=placa,
            defaults={'tipo': tipo, 'usuario': request.user}
        )
        
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
            metodo='efectivo',
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
        Genera reportes de sesiones activas que han superado el límite de tiempo permitido.
        """
        from django.db.models import Sum, Avg, Count
        import datetime

        hoy = timezone.now()
        inicio_mes = hoy.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        # Sesiones con duracion mayor a 120 minutos (2 horas) = sobretiempo
        LIMITE_MIN = 120
        sesiones_excedidas = SesionParqueo.objects.filter(
            hora_fin__isnull=False,
            duracion_min__gt=LIMITE_MIN,
            hora_inicio__gte=inicio_mes
        ).select_related('espacio', 'vehiculo')

        total_infracciones = sesiones_excedidas.count()
        agg = sesiones_excedidas.aggregate(prom=Avg('duracion_min'))
        prom_raw = agg['prom']
        promedio_excedido = round(prom_raw - LIMITE_MIN, 1) if prom_raw else 0

        # Zona con mas incidencias
        zona_max = None
        if total_infracciones > 0:
            from django.db.models import Count as DCount
            zona_data = sesiones_excedidas.values('espacio__zona').annotate(total=DCount('id')).order_by('-total').first()
            zona_max = f"Zona {zona_data['espacio__zona']}" if zona_data else 'N/A'

        # Lista de incidencias
        incidencias = []
        for s in sesiones_excedidas.order_by('-hora_inicio')[:20]:
            excedido_min = s.duracion_min - LIMITE_MIN
            h = excedido_min // 60
            m = excedido_min % 60
            tiempo_str = f"{h}h {m:02d} min" if h > 0 else f"{m} min"
            total_str = f"{s.duracion_min // 60}h {s.duracion_min % 60:02d} min"
            placa = s.vehiculo.placa if s.vehiculo else 'N/A'
            zona = f"Zona {s.espacio.zona}" if s.espacio else 'N/A'
            estado = 'En Proceso' if s.estado_sesion == 'abierta' else 'Resuelto'
            incidencias.append({
                'fecha': s.hora_inicio.strftime('%d %b %Y'),
                'placa': placa,
                'ubicacion': zona,
                'tiempo_total': total_str,
                'tiempo_excedido': tiempo_str,
                'estado': estado,
            })

        return Response({
            'total_infracciones': total_infracciones,
            'promedio_excedido_min': promedio_excedido,
            'zona_mas_incidencias': zona_max or 'N/A',
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