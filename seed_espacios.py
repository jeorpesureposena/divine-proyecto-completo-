from core.models import EspacioParqueo, Sensor
from django.utils import timezone

# Borrar espacios y sensores anteriores
Sensor.objects.all().delete()
EspacioParqueo.objects.all().delete()
print("Espacios anteriores eliminados.")

# 4 zonas x 15 puestos = 60 total
# Zona C: 13 estandar + 2 discapacitados
numero = 1
creados = 0

for zona in ['A', 'B', 'C', 'D']:
    for i in range(1, 16):
        if zona == 'C' and i >= 14:
            tipo = 'discapacitado'
        else:
            tipo = 'estandar'
        
        esp = EspacioParqueo.objects.create(
            numero=numero,
            zona=zona,
            tipo=tipo,
            estado='libre'
        )
        Sensor.objects.create(
            espacio=esp,
            tipo_sensor='ultrasonico',
            estado_sensor=True,
            fecha_ultima_lectura=timezone.now()
        )
        numero += 1
        creados += 1

print(f"Creados: {creados} espacios")
for z in ['A', 'B', 'C', 'D']:
    n = EspacioParqueo.objects.filter(zona=z).count()
    print(f"  Zona {z}: {n} puestos")

libres = EspacioParqueo.objects.filter(estado='libre').count()
print(f"Total libres: {libres}")
