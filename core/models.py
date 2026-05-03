from django.db import models
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin


# ─── MANAGER DE USUARIO ───────────────────────────────────────────
class UsuarioManager(BaseUserManager):
    def create_user(self, correo, nombre, password=None, **extra_fields):
        if not correo:
            raise ValueError('El correo es obligatorio')
        correo = self.normalize_email(correo)
        user = self.model(correo=correo, nombre=nombre, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, correo, nombre, password=None, **extra_fields):
        extra_fields.setdefault('rol', 'administrador')
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        return self.create_user(correo, nombre, password, **extra_fields)


# ─── USUARIO ──────────────────────────────────────────────────────
class Usuario(AbstractBaseUser, PermissionsMixin):
    ROL_CHOICES = [
        ('conductor', 'Conductor'),
        ('operador', 'Operador'),
        ('administrador', 'Administrador'),
    ]

    nombre           = models.CharField(max_length=100)
    correo           = models.EmailField(unique=True)
    rol              = models.CharField(max_length=20, choices=ROL_CHOICES, default='conductor')
    estado           = models.BooleanField(default=True)
    codigo_operador  = models.CharField(max_length=20, unique=True, blank=True, null=True)
    is_staff         = models.BooleanField(default=False)
    is_active        = models.BooleanField(default=True)
    fecha_creacion   = models.DateTimeField(auto_now_add=True)

    USERNAME_FIELD  = 'correo'
    REQUIRED_FIELDS = ['nombre']

    objects = UsuarioManager()

    def __str__(self):
        return f'{self.nombre} ({self.rol})'

    class Meta:
        db_table = 'usuario'


# ─── VEHÍCULO ─────────────────────────────────────────────────────
class Vehiculo(models.Model):
    TIPO_CHOICES = [
        ('carro', 'Carro'),
        ('moto', 'Moto'),
        ('camioneta', 'Camioneta'),
    ]

    usuario = models.ForeignKey(Usuario, on_delete=models.CASCADE, related_name='vehiculos')
    placa   = models.CharField(max_length=20, unique=True)
    tipo    = models.CharField(max_length=50, choices=TIPO_CHOICES)
    marca   = models.CharField(max_length=50, blank=True, null=True)
    color   = models.CharField(max_length=50, blank=True, null=True)
    modelo  = models.CharField(max_length=50, blank=True, null=True)

    def __str__(self):
        return f'{self.placa} - {self.marca}'

    class Meta:
        db_table = 'vehiculo'


# ─── ESPACIO DE PARQUEO ───────────────────────────────────────────
class EspacioParqueo(models.Model):
    ESTADO_CHOICES = [
        ('libre', 'Libre'),
        ('ocupado', 'Ocupado'),
        ('reservado', 'Reservado'),
        ('mantenimiento', 'Mantenimiento'),
    ]
    TIPO_CHOICES = [
        ('estandar', 'Estándar'),
        ('discapacitado', 'Discapacitado'),
    ]
    ZONA_CHOICES = [
        ('A', 'Zona A'),
        ('B', 'Zona B'),
        ('C', 'Zona C'),
        ('D', 'Zona D'),
    ]

    numero = models.IntegerField(unique=True)
    zona   = models.CharField(max_length=1, choices=ZONA_CHOICES, default='A')
    tipo   = models.CharField(max_length=50, choices=TIPO_CHOICES, default='estandar')
    estado = models.CharField(max_length=20, choices=ESTADO_CHOICES, default='libre')
    
    # Campos para mantenimiento
    motivo_mantenimiento = models.TextField(blank=True, null=True)
    duracion_mantenimiento = models.CharField(max_length=50, blank=True, null=True)

    def __str__(self):
        return f'Zona {self.zona} - #{self.numero:02d} ({self.estado})'

    class Meta:
        db_table = 'espacio_parqueo'
        ordering = ['zona', 'numero']


# ─── SENSOR ───────────────────────────────────────────────────────
class Sensor(models.Model):
    espacio              = models.OneToOneField(EspacioParqueo, on_delete=models.CASCADE, related_name='sensor')
    tipo_sensor          = models.CharField(max_length=50, default='ultrasonico')
    estado_sensor        = models.BooleanField(default=True)
    fecha_ultima_lectura = models.DateTimeField(blank=True, null=True)

    def __str__(self):
        return f'Sensor - Espacio #{self.espacio.numero}'

    class Meta:
        db_table = 'sensor'


# ─── TARIFA ───────────────────────────────────────────────────────
class Tarifa(models.Model):
    valor_hora      = models.DecimalField(max_digits=10, decimal_places=2)
    valor_fraccion  = models.DecimalField(max_digits=10, decimal_places=2)
    vigencia_inicio = models.DateTimeField()
    vigencia_fin    = models.DateTimeField()
    activa          = models.BooleanField(default=True)

    def __str__(self):
        return f'Tarifa ${self.valor_hora}/hora'

    class Meta:
        db_table = 'tarifa'


# ─── RESERVA ──────────────────────────────────────────────────────
class Reserva(models.Model):
    ESTADO_CHOICES = [
        ('activa', 'Activa'),
        ('cancelada', 'Cancelada'),
        ('finalizada', 'Finalizada'),
        ('expirada', 'Expirada'),
    ]

    usuario       = models.ForeignKey(Usuario, on_delete=models.CASCADE, related_name='reservas')
    espacio       = models.ForeignKey(EspacioParqueo, on_delete=models.CASCADE, related_name='reservas')
    vehiculo      = models.ForeignKey(Vehiculo, on_delete=models.SET_NULL, null=True, related_name='reservas')
    fecha_reserva = models.DateTimeField(auto_now_add=True)
    fecha_inicio  = models.DateTimeField()
    fecha_fin     = models.DateTimeField()
    estado        = models.CharField(max_length=20, choices=ESTADO_CHOICES, default='activa')
    penalizacion  = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    def __str__(self):
        return f'Reserva #{self.id} - {self.usuario.nombre}'

    class Meta:
        db_table = 'reserva'


# ─── SESIÓN DE PARQUEO ────────────────────────────────────────────
class SesionParqueo(models.Model):
    ESTADO_CHOICES = [
        ('abierta', 'Abierta'),
        ('cerrada', 'Cerrada'),
        ('pendiente', 'Pendiente'),
    ]

    reserva       = models.ForeignKey(Reserva, on_delete=models.SET_NULL, null=True, blank=True, related_name='sesiones')
    vehiculo      = models.ForeignKey(Vehiculo, on_delete=models.SET_NULL, null=True, related_name='sesiones')
    espacio       = models.ForeignKey(EspacioParqueo, on_delete=models.CASCADE, related_name='sesiones')
    hora_inicio   = models.DateTimeField()
    hora_fin      = models.DateTimeField(blank=True, null=True)
    estado_sesion = models.CharField(max_length=20, choices=ESTADO_CHOICES, default='abierta')
    duracion_min  = models.IntegerField(default=0)

    def __str__(self):
        return f'Sesion #{self.id} - Espacio #{self.espacio.numero}'

    class Meta:
        db_table = 'sesion_parqueo'


# ─── PAGO ─────────────────────────────────────────────────────────
class Pago(models.Model):
    METODO_CHOICES = [
        ('efectivo', 'Efectivo'),
        ('tarjeta', 'Tarjeta'),
        ('app', 'App'),
    ]
    ESTADO_CHOICES = [
        ('aprobado', 'Aprobado'),
        ('rechazado', 'Rechazado'),
        ('pendiente', 'Pendiente'),
    ]

    sesion      = models.ForeignKey(SesionParqueo, on_delete=models.CASCADE, related_name='pagos', null=True, blank=True)
    reserva     = models.ForeignKey(Reserva, on_delete=models.CASCADE, related_name='pagos', null=True, blank=True)
    tarifa      = models.ForeignKey(Tarifa, on_delete=models.SET_NULL, null=True, related_name='pagos')
    monto       = models.DecimalField(max_digits=10, decimal_places=2)
    metodo      = models.CharField(max_length=20, choices=METODO_CHOICES)
    estado_pago = models.CharField(max_length=20, choices=ESTADO_CHOICES, default='pendiente')
    fecha       = models.DateTimeField(auto_now_add=True)
    comprobante = models.CharField(max_length=100, blank=True, null=True)

    def __str__(self):
        return f'Pago #{self.id} - ${self.monto}'

    class Meta:
        db_table = 'pago'


# ─── EVENTO DE ACCESO ─────────────────────────────────────────────
class EventoAcceso(models.Model):
    TIPO_CHOICES = [
        ('entrada', 'Entrada'),
        ('salida', 'Salida'),
    ]

    vehiculo    = models.ForeignKey(Vehiculo, on_delete=models.SET_NULL, null=True, related_name='eventos')
    operador    = models.ForeignKey(Usuario, on_delete=models.SET_NULL, null=True, blank=True, related_name='eventos_registrados')
    sesion      = models.ForeignKey(SesionParqueo, on_delete=models.SET_NULL, null=True, blank=True, related_name='eventos')
    espacio     = models.ForeignKey(EspacioParqueo, on_delete=models.CASCADE, related_name='eventos')
    tipo_evento = models.CharField(max_length=10, choices=TIPO_CHOICES)
    fecha_hora  = models.DateTimeField(auto_now_add=True)
    placa_detectada = models.CharField(max_length=20)
    es_manual   = models.BooleanField(default=False)

    def __str__(self):
        return f'{self.tipo_evento} - {self.placa_detectada} - {self.fecha_hora}'

    class Meta:
        db_table = 'evento_acceso'


# ─── AUTORIZACIÓN EXCEPCIONAL ─────────────────────────────────────
class AutorizacionExcepcional(models.Model):
    TIPO_CHOICES = [
        ('entrada', 'Entrada'),
        ('salida', 'Salida'),
    ]

    operador    = models.ForeignKey(Usuario, on_delete=models.SET_NULL, null=True, related_name='autorizaciones')
    vehiculo    = models.ForeignKey(Vehiculo, on_delete=models.SET_NULL, null=True, blank=True, related_name='autorizaciones')
    espacio     = models.ForeignKey(EspacioParqueo, on_delete=models.SET_NULL, null=True, related_name='autorizaciones')
    placa       = models.CharField(max_length=20)
    tipo        = models.CharField(max_length=10, choices=TIPO_CHOICES)
    motivo      = models.TextField()
    fecha_hora  = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'Autorizacion {self.tipo} - {self.placa}'

    class Meta:
        db_table = 'autorizacion_excepcional'


# ─── CÁMARA OCR ───────────────────────────────────────────────────
class CamaraOCR(models.Model):
    ubicacion      = models.CharField(max_length=100)
    ultima_lectura = models.DateTimeField(blank=True, null=True)
    activa         = models.BooleanField(default=True)

    def __str__(self):
        return f'Camara OCR - {self.ubicacion}'

    class Meta:
        db_table = 'camara_ocr'


# ─── LECTURA OCR ──────────────────────────────────────────────────
class LecturaOCR(models.Model):
    camara          = models.ForeignKey(CamaraOCR, on_delete=models.CASCADE, related_name='lecturas')
    vehiculo        = models.ForeignKey(Vehiculo, on_delete=models.SET_NULL, null=True, blank=True, related_name='lecturas')
    placa_detectada = models.CharField(max_length=20)
    fecha_hora      = models.DateTimeField(auto_now_add=True)
    resultado       = models.BooleanField(default=False)

    def __str__(self):
        return f'Lectura {self.placa_detectada} - {self.fecha_hora}'

    class Meta:
        db_table = 'lectura_ocr'


# ─── BARRERA ──────────────────────────────────────────────────────
class Barrera(models.Model):
    ESTADO_CHOICES = [
        ('abierta', 'Abierta'),
        ('cerrada', 'Cerrada'),
        ('bloqueada', 'Bloqueada'),
    ]

    ubicacion     = models.CharField(max_length=100)
    estado        = models.CharField(max_length=20, choices=ESTADO_CHOICES, default='cerrada')
    ultima_accion = models.DateTimeField(blank=True, null=True)

    def __str__(self):
        return f'Barrera - {self.ubicacion} ({self.estado})'

    class Meta:
        db_table = 'barrera'


# ─── NOTIFICACIÓN ─────────────────────────────────────────────────
class Notificacion(models.Model):
    TIPO_CHOICES = [
        ('reserva', 'Reserva'),
        ('pago', 'Pago'),
        ('alerta', 'Alerta'),
        ('sistema', 'Sistema'),
    ]

    usuario = models.ForeignKey(Usuario, on_delete=models.CASCADE, related_name='notificaciones')
    tipo    = models.CharField(max_length=20, choices=TIPO_CHOICES)
    mensaje = models.TextField()
    leida   = models.BooleanField(default=False)
    fecha   = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'Notificacion {self.tipo} - {self.usuario.nombre}'

    class Meta:
        db_table = 'notificacion'


# ─── REPORTE ──────────────────────────────────────────────────────
class Reporte(models.Model):
    FORMATO_CHOICES = [
        ('pdf', 'PDF'),
        ('csv', 'CSV'),
        ('excel', 'Excel'),
    ]

    usuario          = models.ForeignKey(Usuario, on_delete=models.CASCADE, related_name='reportes')
    tipo_reporte     = models.CharField(max_length=50)
    fecha_generacion = models.DateTimeField(auto_now_add=True)
    formato          = models.CharField(max_length=20, choices=FORMATO_CHOICES)

    def __str__(self):
        return f'Reporte {self.tipo_reporte} - {self.fecha_generacion}'

    class Meta:
        db_table = 'reporte'


# ─── CÓDIGO DE RECUPERACIÓN ───────────────────────────────────────
class CodigoRecuperacion(models.Model):
    usuario = models.ForeignKey(Usuario, on_delete=models.CASCADE, related_name='codigos_recuperacion')
    codigo = models.CharField(max_length=6)
    creado_en = models.DateTimeField(auto_now_add=True)
    usado = models.BooleanField(default=False)

    def es_valido(self):
        # Válido por 15 minutos
        from django.utils import timezone
        import datetime
        ahora = timezone.now()
        limite = self.creado_en + datetime.timedelta(minutes=15)
        return not self.usado and ahora <= limite

    def __str__(self):
        return f'Codigo {self.codigo} - {self.usuario.correo}'

    class Meta:
        db_table = 'codigo_recuperacion'