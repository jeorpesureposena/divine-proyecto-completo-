from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from .models import (
    Usuario, Vehiculo, EspacioParqueo, Sensor, Tarifa, Reserva,
    SesionParqueo, Pago, EventoAcceso, AutorizacionExcepcional,
    CamaraOCR, LecturaOCR, Barrera, Notificacion, Reporte
)


# ─── REGISTRO ─────────────────────────────────────────────────────
class RegistroSerializer(serializers.ModelSerializer):
    password  = serializers.CharField(write_only=True, required=True, validators=[validate_password])
    password2 = serializers.CharField(write_only=True, required=True)

    class Meta:
        model  = Usuario
        fields = ['nombre', 'correo', 'password', 'password2', 'rol', 'codigo_operador']

    def validate(self, attrs):
        if attrs['password'] != attrs['password2']:
            raise serializers.ValidationError({'password': 'Las contraseñas no coinciden'})
        return attrs

    def create(self, validated_data):
        validated_data.pop('password2')
        password = validated_data.pop('password')
        usuario  = Usuario(**validated_data)
        usuario.set_password(password)
        usuario.save()
        return usuario


# ─── PERFIL DE USUARIO ────────────────────────────────────────────
class UsuarioSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Usuario
        fields = ['id', 'nombre', 'correo', 'rol', 'estado', 'codigo_operador', 'fecha_creacion']


# ─── CAMBIAR CONTRASEÑA ───────────────────────────────────────────
class CambiarPasswordSerializer(serializers.Serializer):
    password_actual = serializers.CharField(required=True)
    password_nuevo  = serializers.CharField(required=True, validators=[validate_password])
    password_nuevo2 = serializers.CharField(required=True)

    def validate(self, attrs):
        if attrs['password_nuevo'] != attrs['password_nuevo2']:
            raise serializers.ValidationError({'password_nuevo': 'Las contraseñas no coinciden'})
        return attrs


# ─── SERIALIZERS DE NEGOCIO ───────────────────────────────────────

class VehiculoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Vehiculo
        fields = '__all__'


class EspacioParqueoSerializer(serializers.ModelSerializer):
    zona_display = serializers.CharField(source='get_zona_display', read_only=True)

    class Meta:
        model = EspacioParqueo
        fields = '__all__'


class SensorSerializer(serializers.ModelSerializer):
    espacio_numero = serializers.IntegerField(source='espacio.numero', read_only=True)
    
    class Meta:
        model = Sensor
        fields = '__all__'


class TarifaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tarifa
        fields = '__all__'


class ReservaSerializer(serializers.ModelSerializer):
    usuario_nombre = serializers.CharField(source='usuario.nombre', read_only=True)
    vehiculo_placa = serializers.CharField(source='vehiculo.placa', read_only=True)
    espacio_numero = serializers.IntegerField(source='espacio.numero', read_only=True)

    class Meta:
        model = Reserva
        fields = '__all__'


class SesionParqueoSerializer(serializers.ModelSerializer):
    vehiculo_placa = serializers.CharField(source='vehiculo.placa', read_only=True)
    espacio_numero = serializers.IntegerField(source='espacio.numero', read_only=True)

    class Meta:
        model = SesionParqueo
        fields = '__all__'


class PagoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Pago
        fields = '__all__'


class EventoAccesoSerializer(serializers.ModelSerializer):
    vehiculo_placa = serializers.CharField(source='vehiculo.placa', read_only=True)
    espacio_numero = serializers.IntegerField(source='espacio.numero', read_only=True)
    operador_nombre = serializers.CharField(source='operador.nombre', read_only=True)

    class Meta:
        model = EventoAcceso
        fields = '__all__'


class AutorizacionExcepcionalSerializer(serializers.ModelSerializer):
    operador_nombre = serializers.CharField(source='operador.nombre', read_only=True)

    class Meta:
        model = AutorizacionExcepcional
        fields = '__all__'


class CamaraOCRSerializer(serializers.ModelSerializer):
    class Meta:
        model = CamaraOCR
        fields = '__all__'


class LecturaOCRSerializer(serializers.ModelSerializer):
    class Meta:
        model = LecturaOCR
        fields = '__all__'


class BarreraSerializer(serializers.ModelSerializer):
    class Meta:
        model = Barrera
        fields = '__all__'


class NotificacionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notificacion
        fields = '__all__'


class ReporteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Reporte
        fields = '__all__'