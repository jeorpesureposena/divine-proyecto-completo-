from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate
from .models import Usuario
from .serializers import RegistroSerializer, UsuarioSerializer, CambiarPasswordSerializer


# ─── REGISTRO ─────────────────────────────────────────────────────
@api_view(['POST'])
@permission_classes([AllowAny])
def registro(request):
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
@api_view(['POST'])
@permission_classes([AllowAny])
def login(request):
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
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def perfil(request):
    serializer = UsuarioSerializer(request.user)
    return Response(serializer.data)


# ─── RECUPERAR CONTRASEÑA (FLUJO CÓDIGO EMAIL) ────────────────────
import random
from django.core.mail import send_mail
from .models import CodigoRecuperacion

@api_view(['POST'])
@permission_classes([AllowAny])
def enviar_codigo_recuperacion(request):
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


@api_view(['POST'])
@permission_classes([AllowAny])
def verificar_codigo(request):
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


@api_view(['POST'])
@permission_classes([AllowAny])
def restablecer_password(request):
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
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def cambiar_password(request):
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
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout(request):
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
    CamaraOCR, LecturaOCR, Barrera, Notificacion, Reporte
)
from .serializers import (
    VehiculoSerializer, EspacioParqueoSerializer, SensorSerializer,
    TarifaSerializer, ReservaSerializer, SesionParqueoSerializer,
    PagoSerializer, EventoAccesoSerializer, AutorizacionExcepcionalSerializer,
    CamaraOCRSerializer, LecturaOCRSerializer, BarreraSerializer,
    NotificacionSerializer, ReporteSerializer
)
from .permissions import IsAdministrador, IsOperador, IsConductor, IsAdministradorOrReadOnly, IsOperadorOrAdministrador


class VehiculoViewSet(viewsets.ModelViewSet):
    queryset = Vehiculo.objects.all()
    serializer_class = VehiculoSerializer
    permission_classes = [IsAuthenticated]


class EspacioParqueoViewSet(viewsets.ModelViewSet):
    queryset = EspacioParqueo.objects.all()
    serializer_class = EspacioParqueoSerializer
    permission_classes = [IsAdministradorOrReadOnly]


class SensorViewSet(viewsets.ModelViewSet):
    queryset = Sensor.objects.all()
    serializer_class = SensorSerializer
    permission_classes = [IsAdministradorOrReadOnly]


class TarifaViewSet(viewsets.ModelViewSet):
    queryset = Tarifa.objects.all()
    serializer_class = TarifaSerializer
    permission_classes = [IsAdministradorOrReadOnly]


class ReservaViewSet(viewsets.ModelViewSet):
    queryset = Reserva.objects.all()
    serializer_class = ReservaSerializer
    permission_classes = [IsAuthenticated]


class SesionParqueoViewSet(viewsets.ModelViewSet):
    queryset = SesionParqueo.objects.all()
    serializer_class = SesionParqueoSerializer
    permission_classes = [IsOperadorOrAdministrador]

    @action(detail=False, methods=['post'], url_path='entrada-manual')
    def entrada_manual(self, request):
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


class PagoViewSet(viewsets.ModelViewSet):
    queryset = Pago.objects.all()
    serializer_class = PagoSerializer
    permission_classes = [IsAuthenticated]


class EventoAccesoViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = EventoAcceso.objects.all()
    serializer_class = EventoAccesoSerializer
    permission_classes = [IsOperadorOrAdministrador]


class AutorizacionExcepcionalViewSet(viewsets.ModelViewSet):
    queryset = AutorizacionExcepcional.objects.all()
    serializer_class = AutorizacionExcepcionalSerializer
    permission_classes = [IsOperadorOrAdministrador]

    def perform_create(self, serializer):
        serializer.save(operador=self.request.user)


class CamaraOCRViewSet(viewsets.ModelViewSet):
    queryset = CamaraOCR.objects.all()
    serializer_class = CamaraOCRSerializer
    permission_classes = [IsOperadorOrAdministrador]


class LecturaOCRViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = LecturaOCR.objects.all()
    serializer_class = LecturaOCRSerializer
    permission_classes = [IsOperadorOrAdministrador]


class BarreraViewSet(viewsets.ModelViewSet):
    queryset = Barrera.objects.all()
    serializer_class = BarreraSerializer
    permission_classes = [IsOperadorOrAdministrador]


class NotificacionViewSet(viewsets.ModelViewSet):
    queryset = Notificacion.objects.all()
    serializer_class = NotificacionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # Operadores y administradores ven todas las alertas de sistema
        usuario = self.request.user
        if hasattr(usuario, 'rol') and usuario.rol in ['operador', 'administrador']:
            return Notificacion.objects.all().order_by('-fecha')
        return Notificacion.objects.filter(usuario=self.request.user).order_by('-fecha')


class ReporteViewSet(viewsets.ModelViewSet):
    queryset = Reporte.objects.all()
    serializer_class = ReporteSerializer
    permission_classes = [IsAdministrador]


class EstadisticasViewSet(viewsets.ViewSet):
    permission_classes = [IsOperadorOrAdministrador]

    @action(detail=False, methods=['get'])
    def tablero(self, request):
        total_espacios = EspacioParqueo.objects.count()
        espacios_ocupados = EspacioParqueo.objects.filter(estado='ocupado').count()
        espacios_libres = EspacioParqueo.objects.filter(estado='libre').count()

        hoy = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)
        pagos_hoy = Pago.objects.filter(fecha__gte=hoy, estado_pago='aprobado')
        ingresos_hoy = sum(p.monto for p in pagos_hoy)

        # Sensores
        total_sensores = Sensor.objects.count()
        sensores_activos = Sensor.objects.filter(estado_sensor=True).count()

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