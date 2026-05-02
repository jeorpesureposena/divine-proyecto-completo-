from rest_framework import permissions

class IsAdministrador(permissions.BasePermission):
    """
    Permite acceso solo a usuarios con rol 'administrador'.
    """
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.rol == 'administrador')


class IsOperador(permissions.BasePermission):
    """
    Permite acceso solo a usuarios con rol 'operador'.
    """
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.rol == 'operador')


class IsConductor(permissions.BasePermission):
    """
    Permite acceso solo a usuarios con rol 'conductor'.
    """
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.rol == 'conductor')


class IsAdministradorOrReadOnly(permissions.BasePermission):
    """
    Permite operaciones de escritura solo a administradores.
    Operaciones de lectura a cualquier usuario autenticado.
    """
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return bool(request.user and request.user.is_authenticated)
        return bool(request.user and request.user.is_authenticated and request.user.rol == 'administrador')


class IsOperadorOrAdministrador(permissions.BasePermission):
    """
    Permite acceso a operadores y administradores.
    """
    def has_permission(self, request, view):
        return bool(
            request.user and request.user.is_authenticated and 
            request.user.rol in ['operador', 'administrador']
        )
