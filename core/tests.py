from django.test import TestCase
from core.models import EspacioParqueo
from core.serializers import EspacioParqueoSerializer

class EspacioParqueoTestCase(TestCase):
    def setUp(self):
        self.espacio = EspacioParqueo.objects.create(
            numero=101,
            zona='A',
            tipo='estandar',
            estado='mantenimiento',
            motivo_mantenimiento='Falla en el sensor',
            duracion_mantenimiento='Indefinido'
        )

    def test_mantenimiento_keeps_details(self):
        # Si actualizamos y sigue en mantenimiento, se deben mantener o permitir cambiar los detalles
        serializer = EspacioParqueoSerializer(
            instance=self.espacio,
            data={'estado': 'mantenimiento', 'motivo_mantenimiento': 'Nueva falla', 'duracion_mantenimiento': '2 horas'},
            partial=True
        )
        self.assertTrue(serializer.is_valid())
        serializer.save()
        self.espacio.refresh_from_db()
        self.assertEqual(self.espacio.estado, 'mantenimiento')
        self.assertEqual(self.espacio.motivo_mantenimiento, 'Nueva falla')
        self.assertEqual(self.espacio.duracion_mantenimiento, '2 horas')

    def test_change_to_libre_clears_details(self):
        # Si cambia a libre, motivo y duracion de mantenimiento deben ser None
        serializer = EspacioParqueoSerializer(
            instance=self.espacio,
            data={'estado': 'libre'},
            partial=True
        )
        self.assertTrue(serializer.is_valid())
        serializer.save()
        self.espacio.refresh_from_db()
        self.assertEqual(self.espacio.estado, 'libre')
        self.assertIsNone(self.espacio.motivo_mantenimiento)
        self.assertIsNone(self.espacio.duracion_mantenimiento)

    def test_change_to_ocupado_clears_details(self):
        # Si cambia a ocupado, motivo y duracion de mantenimiento deben ser None
        serializer = EspacioParqueoSerializer(
            instance=self.espacio,
            data={'estado': 'ocupado'},
            partial=True
        )
        self.assertTrue(serializer.is_valid())
        serializer.save()
        self.espacio.refresh_from_db()
        self.assertEqual(self.espacio.estado, 'ocupado')
        self.assertIsNone(self.espacio.motivo_mantenimiento)
        self.assertIsNone(self.espacio.duracion_mantenimiento)

    def test_create_libre_clears_passed_details(self):
        # Si se crea un espacio con estado libre pero con detalles de mantenimiento, se deben limpiar
        serializer = EspacioParqueoSerializer(
            data={
                'numero': 102,
                'zona': 'A',
                'tipo': 'estandar',
                'estado': 'libre',
                'motivo_mantenimiento': 'No deberia estar aqui',
                'duracion_mantenimiento': '1 dia'
            }
        )
        self.assertTrue(serializer.is_valid())
        nuevo_espacio = serializer.save()
        self.assertEqual(nuevo_espacio.estado, 'libre')
        self.assertIsNone(nuevo_espacio.motivo_mantenimiento)
        self.assertIsNone(nuevo_espacio.duracion_mantenimiento)
