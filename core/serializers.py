from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from .models import (
    Usuario, Vehiculo, EspacioParqueo, Sensor, Tarifa, Reserva,
    SesionParqueo, Pago, EventoAcceso, AutorizacionExcepcional,
    CamaraOCR, LecturaOCR, Barrera, Notificacion, Reporte,
    Billetera, Recarga
)


# ─── REGISTRO ─────────────────────────────────────────────────────
class RegistroSerializer(serializers.ModelSerializer):
    """
    Serializer para el registro de nuevos usuarios en la plataforma.
    """
    password  = serializers.CharField(write_only=True, required=True, validators=[validate_password])
    password2 = serializers.CharField(write_only=True, required=True)

    class Meta:
        model  = Usuario
        fields = ['nombre', 'correo', 'password', 'password2', 'rol', 'codigo_operador']

    def validate_correo(self, value):
        """
        Valida que el correo no esté ya registrado en la base de datos.
        """
        if Usuario.objects.filter(correo=value).exists():
            raise serializers.ValidationError('El correo ya está registrado.')
        return value

    def validate(self, attrs):
        """
        Valida que ambas contraseñas proporcionadas coincidan.
        """
        if attrs['password'] != attrs['password2']:
            raise serializers.ValidationError({'password': 'Las contraseñas no coinciden'})
        return attrs

    def create(self, validated_data):
        """
        Crea un nuevo usuario en la base de datos asegurando que la contraseña se encripte correctamente.
        """
        validated_data.pop('password2')
        password = validated_data.pop('password')
        usuario  = Usuario(**validated_data)
        usuario.set_password(password)
        usuario.save()
        return usuario


# ─── PERFIL DE USUARIO ────────────────────────────────────────────
class UsuarioSerializer(serializers.ModelSerializer):
    """
    Serializer para representar el perfil y los detalles de un usuario existente.
    """
    class Meta:
        model  = Usuario
        fields = ['id', 'nombre', 'correo', 'rol', 'estado', 'codigo_operador', 'fecha_creacion']


# ─── CAMBIAR CONTRASEÑA ───────────────────────────────────────────
class CambiarPasswordSerializer(serializers.Serializer):
    """
    Serializer para gestionar el cambio de contraseña de un usuario autenticado.
    """
    password_actual = serializers.CharField(required=True)
    password_nuevo  = serializers.CharField(required=True, validators=[validate_password])
    password_nuevo2 = serializers.CharField(required=True)

    def validate(self, attrs):
        """
        Verifica que la nueva contraseña y su confirmación sean idénticas.
        """
        if attrs['password_nuevo'] != attrs['password_nuevo2']:
            raise serializers.ValidationError({'password_nuevo': 'Las contraseñas no coinciden'})
        return attrs


# ─── SERIALIZERS DE NEGOCIO ───────────────────────────────────────

class VehiculoSerializer(serializers.ModelSerializer):
    """
    Serializer para gestionar los vehículos asociados a un usuario.
    """
    class Meta:
        model = Vehiculo
        fields = '__all__'
        read_only_fields = ['usuario']


class EspacioParqueoSerializer(serializers.ModelSerializer):
    """
    Serializer para los espacios de parqueo, incluyendo la representación legible de su zona.
    """
    zona_display = serializers.CharField(source='get_zona_display', read_only=True)
    estado = serializers.SerializerMethodField()
    info_reserva = serializers.SerializerMethodField()

    class Meta:
        model = EspacioParqueo
        fields = '__all__'

    def to_internal_value(self, data):
        ret = super().to_internal_value(data)
        if 'estado' in data:
            estado_val = data['estado']
            if estado_val in ['libre', 'ocupado', 'mantenimiento']:
                ret['estado'] = estado_val
            else:
                raise serializers.ValidationError({'estado': 'Estado inválido.'})
        return ret

    def validate(self, attrs):
        estado = attrs.get('estado')
        if estado is None:
            if self.instance:
                estado = self.instance.estado
            else:
                estado = self.Meta.model._meta.get_field('estado').default

        if estado != 'mantenimiento':
            attrs['motivo_mantenimiento'] = None
            attrs['duracion_mantenimiento'] = None
        return attrs

    def get_estado(self, obj):
        if obj.estado in ['ocupado', 'mantenimiento']:
            return obj.estado
        from django.utils import timezone
        ahora = timezone.now()
        reserva_activa = obj.reservas.filter(
            estado='activa', 
            fecha_inicio__lte=ahora, 
            fecha_fin__gte=ahora
        ).exists()
        if reserva_activa:
            return 'reservado'
        return 'libre'

    def get_info_reserva(self, obj):
        from django.utils import timezone
        ahora = timezone.now()
        reserva = obj.reservas.filter(
            estado='activa', 
            fecha_inicio__lte=ahora, 
            fecha_fin__gte=ahora
        ).first()
        if reserva:
            return {
                'id': reserva.id,
                'usuario_nombre': reserva.usuario.nombre,
                'vehiculo_placa': reserva.vehiculo.placa if reserva.vehiculo else 'N/A',
                'fecha_inicio': reserva.fecha_inicio.isoformat() if reserva.fecha_inicio else None,
                'fecha_fin': reserva.fecha_fin.isoformat() if reserva.fecha_fin else None,
                'estado': reserva.estado
            }
        return None


class SensorSerializer(serializers.ModelSerializer):
    """
    Serializer para la información de los sensores de ocupación de espacios de parqueo.
    """
    espacio_numero = serializers.IntegerField(source='espacio.numero', read_only=True)
    
    class Meta:
        model = Sensor
        fields = '__all__'


class TarifaSerializer(serializers.ModelSerializer):
    """
    Serializer para la configuración de tarifas del parqueadero.
    """
    class Meta:
        model = Tarifa
        fields = '__all__'


class ReservaSerializer(serializers.ModelSerializer):
    """
    Serializer para procesar las reservas de espacios de parqueo realizadas por los usuarios.
    """
    usuario_nombre = serializers.CharField(source='usuario.nombre', read_only=True)
    vehiculo_placa = serializers.CharField(source='vehiculo.placa', read_only=True)
    espacio_numero = serializers.IntegerField(source='espacio.numero', read_only=True)
    espacio_zona   = serializers.CharField(source='espacio.zona', read_only=True)
    monto_total    = serializers.SerializerMethodField()
    metodo_pago    = serializers.SerializerMethodField()

    class Meta:
        model = Reserva
        fields = '__all__'

    def get_monto_total(self, obj):
        """
        Calcula y obtiene el monto total del pago asociado a la reserva.
        """
        pago = obj.pagos.first()
        return pago.monto if pago else 0

    def get_metodo_pago(self, obj):
        """
        Obtiene el método de pago utilizado para la reserva.
        """
        pago = obj.pagos.first()
        return pago.metodo if pago else 'N/A'

    def validate(self, attrs):
        espacio = attrs.get('espacio')
        fecha_inicio = attrs.get('fecha_inicio')
        fecha_fin = attrs.get('fecha_fin')
        
        if fecha_inicio and fecha_fin and espacio:
            if fecha_inicio >= fecha_fin:
                raise serializers.ValidationError("La fecha de inicio debe ser anterior a la fecha de fin.")
            
            from django.utils import timezone
            from datetime import timedelta
            ahora = timezone.now()
            
            # Evitar crear reservas en el pasado (margen de 5 minutos)
            if fecha_inicio < ahora - timedelta(minutes=5):
                raise serializers.ValidationError({"fecha_inicio": "La fecha y hora de inicio no pueden ser en el pasado. Verifica la fecha seleccionada en tu dispositivo."})
            
            margen = timedelta(minutes=15)
            inicio_con_margen = fecha_inicio - margen
            fin_con_margen = fecha_fin + margen
            
            from .models import Reserva
            solapamientos = Reserva.objects.filter(
                espacio=espacio,
                estado='activa',
                fecha_inicio__lt=fin_con_margen,
                fecha_fin__gt=inicio_con_margen
            )
            
            if self.instance:
                solapamientos = solapamientos.exclude(id=self.instance.id)
                
            if solapamientos.exists():
                raise serializers.ValidationError("El espacio ya está reservado en esa franja horaria (incluyendo 15 min de gracia).")
        
        return attrs


class SesionParqueoSerializer(serializers.ModelSerializer):
    """
    Serializer para el registro de las sesiones de parqueo activas y finalizadas.
    """
    vehiculo_placa = serializers.CharField(source='vehiculo.placa', read_only=True)
    espacio_numero = serializers.IntegerField(source='espacio.numero', read_only=True)

    class Meta:
        model = SesionParqueo
        fields = '__all__'


class PagoSerializer(serializers.ModelSerializer):
    """
    Serializer para el manejo de los pagos realizados en el sistema.
    """
    factura_url = serializers.SerializerMethodField()
    vehiculo_placa = serializers.SerializerMethodField()
    usuario_nombre = serializers.SerializerMethodField()

    class Meta:
        model = Pago
        fields = '__all__'

    def get_factura_url(self, obj):
        request = self.context.get('request')
        if request:
            return request.build_absolute_uri(f'/api/pagos/{obj.id}/factura/')
        return f'/api/pagos/{obj.id}/factura/'

    def get_vehiculo_placa(self, obj):
        if getattr(obj, 'reserva', None) and getattr(obj.reserva, 'vehiculo', None):
            return obj.reserva.vehiculo.placa
        if getattr(obj, 'sesion', None) and getattr(obj.sesion, 'vehiculo', None):
            return obj.sesion.vehiculo.placa
        return None

    def get_usuario_nombre(self, obj):
        if getattr(obj, 'reserva', None) and getattr(obj.reserva, 'usuario', None):
            return getattr(obj.reserva.usuario, 'nombre', getattr(obj.reserva.usuario, 'email', None))
        if getattr(obj, 'sesion', None) and getattr(obj.sesion, 'usuario', None):
            return getattr(obj.sesion.usuario, 'nombre', getattr(obj.sesion.usuario, 'email', None))
        return None


class EventoAccesoSerializer(serializers.ModelSerializer):
    """
    Serializer para los eventos de acceso de vehículos a las instalaciones del parqueadero.
    """
    vehiculo_placa = serializers.CharField(source='vehiculo.placa', read_only=True)
    espacio_numero = serializers.IntegerField(source='espacio.numero', read_only=True)
    espacio_zona = serializers.CharField(source='espacio.zona', read_only=True)
    operador_nombre = serializers.CharField(source='operador.nombre', read_only=True)

    class Meta:
        model = EventoAcceso
        fields = '__all__'


class AutorizacionExcepcionalSerializer(serializers.ModelSerializer):
    """
    Serializer para gestionar autorizaciones excepcionales otorgadas por operadores.
    """
    operador_nombre = serializers.CharField(source='operador.nombre', read_only=True)

    class Meta:
        model = AutorizacionExcepcional
        fields = '__all__'


class CamaraOCRSerializer(serializers.ModelSerializer):
    """
    Serializer para la configuración de las cámaras OCR del sistema.
    """
    class Meta:
        model = CamaraOCR
        fields = '__all__'


class LecturaOCRSerializer(serializers.ModelSerializer):
    """
    Serializer para los registros de las lecturas de placas capturadas por las cámaras OCR.
    """
    class Meta:
        model = LecturaOCR
        fields = '__all__'


class BarreraSerializer(serializers.ModelSerializer):
    """
    Serializer para la gestión y estado de las barreras de acceso.
    """
    class Meta:
        model = Barrera
        fields = '__all__'


class NotificacionSerializer(serializers.ModelSerializer):
    """
    Serializer para las notificaciones enviadas a los usuarios del sistema.
    """
    class Meta:
        model = Notificacion
        fields = '__all__'


class ReporteSerializer(serializers.ModelSerializer):
    """
    Serializer para la generación de reportes operativos y financieros.
    """
    class Meta:
        model = Reporte
        fields = '__all__'


# ─── BILLETERA ────────────────────────────────────────────────────
class BilleteraSerializer(serializers.ModelSerializer):
    """
    Serializer para administrar el saldo y datos de la billetera virtual del usuario.
    """
    usuario_nombre = serializers.CharField(source='usuario.nombre', read_only=True)

    class Meta:
        model = Billetera
        fields = ['id', 'usuario', 'usuario_nombre', 'saldo', 'actualizado']
        read_only_fields = ['usuario', 'actualizado']


# ─── RECARGA ──────────────────────────────────────────────────────
class RecargaSerializer(serializers.ModelSerializer):
    """
    Serializer para gestionar las transacciones de recarga de saldo en la billetera del usuario.
    """
    billetera_id    = serializers.IntegerField(source='billetera.id', read_only=True)
    usuario_nombre  = serializers.CharField(source='billetera.usuario.nombre', read_only=True)
    metodo_display  = serializers.CharField(source='get_metodo_display', read_only=True)
    estado_display  = serializers.CharField(source='get_estado_display', read_only=True)

    class Meta:
        model = Recarga
        fields = ['id', 'billetera_id', 'usuario_nombre', 'monto', 'metodo',
                  'metodo_display', 'estado', 'estado_display', 'fecha']
        read_only_fields = ['fecha']