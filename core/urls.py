from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from . import views

urlpatterns = [
    path('auth/registro/', views.registro, name='registro'),
    path('auth/login/', views.login, name='login'),
    path('auth/operador-login/', views.operador_login, name='operador_login'),
    path('auth/login-admin/', views.login_admin, name='login_admin'),
    path('auth/perfil/', views.perfil, name='perfil'),
    path('debug/whoami/', views.whoami, name='whoami'),
    path('debug/echo/', views.debug_echo, name='debug_echo'),
    path('auth/cambiar-password/', views.cambiar_password, name='cambiar_password'),
    path('auth/recuperar-password/enviar-codigo/', views.enviar_codigo_recuperacion, name='enviar_codigo_recuperacion'),
    path('auth/recuperar-password/verificar-codigo/', views.verificar_codigo, name='verificar_codigo'),
    path('auth/recuperar-password/restablecer/', views.restablecer_password, name='restablecer_password'),
    path('auth/logout/', views.logout, name='logout'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
]

router = DefaultRouter()
router.register(r'vehiculos', views.VehiculoViewSet)
router.register(r'espacios', views.EspacioParqueoViewSet)
router.register(r'sensores', views.SensorViewSet)
router.register(r'tarifas', views.TarifaViewSet)
router.register(r'reservas', views.ReservaViewSet)
router.register(r'sesiones', views.SesionParqueoViewSet)
router.register(r'pagos', views.PagoViewSet)
router.register(r'eventos', views.EventoAccesoViewSet)
router.register(r'autorizaciones', views.AutorizacionExcepcionalViewSet)
router.register(r'camaras', views.CamaraOCRViewSet)
router.register(r'lecturas', views.LecturaOCRViewSet)
router.register(r'barreras', views.BarreraViewSet)
router.register(r'notificaciones', views.NotificacionViewSet)
router.register(r'reportes', views.ReporteViewSet)
router.register(r'estadisticas', views.EstadisticasViewSet, basename='estadisticas')
router.register(r'usuarios', views.UsuarioViewSet, basename='usuarios')
router.register(r'billetera', views.BilleteraViewSet, basename='billetera')
router.register(r'recargas', views.RecargaViewSet, basename='recargas')

urlpatterns += [
    path('', include(router.urls)),
]
