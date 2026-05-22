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

    class Meta:
        model = EspacioParqueo
        fields = '__all__'


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
    class Meta:
        model = Pago
        fields = '__all__'


class EventoAccesoSerializer(serializers.ModelSerializer):
    """
    Serializer para los eventos de acceso de vehículos a las instalaciones del parqueadero.
    """
    vehiculo_placa = serializers.CharField(source='vehiculo.placa', read_only=True)
    espacio_numero = serializers.IntegerField(source='espacio.numero', read_only=True)
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