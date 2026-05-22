from django.contrib import admin
from .models import (
    Usuario, Vehiculo, EspacioParqueo, Sensor, Tarifa, Reserva,
    SesionParqueo, Pago, EventoAcceso, AutorizacionExcepcional,
    CamaraOCR, LecturaOCR, Barrera, Notificacion, Reporte,
    CodigoRecuperacion, Billetera, Recarga
)

# Registramos los modelos para que aparezcan en el panel de administrador
admin.site.register(Usuario)
admin.site.register(Vehiculo)
admin.site.register(EspacioParqueo)
admin.site.register(Sensor)
admin.site.register(Tarifa)
admin.site.register(Reserva)
admin.site.register(SesionParqueo)
admin.site.register(Pago)
admin.site.register(EventoAcceso)
admin.site.register(AutorizacionExcepcional)
admin.site.register(CamaraOCR)
admin.site.register(LecturaOCR)
admin.site.register(Barrera)
admin.site.register(Notificacion)
admin.site.register(Reporte)
admin.site.register(CodigoRecuperacion)
admin.site.register(Billetera)
admin.site.register(Recarga)
