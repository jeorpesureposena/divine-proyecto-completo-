from rest_framework import permissions

class IsAdministrador(permissions.BasePermission):
    """
    Permite acceso solo a usuarios con rol 'administrador'.
    """
    def has_permission(self, request, view):
        """
        Verifica si el usuario autenticado tiene el rol de 'administrador'.
        """
        return bool(request.user and request.user.is_authenticated and request.user.rol == 'administrador')


class IsOperador(permissions.BasePermission):
    """
    Permite acceso solo a usuarios con rol 'operador'.
    """
    def has_permission(self, request, view):
        """
        Verifica si el usuario autenticado tiene el rol de 'operador'.
        """
        return bool(request.user and request.user.is_authenticated and request.user.rol == 'operador')


class IsConductor(permissions.BasePermission):
    """
    Permite acceso solo a usuarios con rol 'conductor'.
    """
    def has_permission(self, request, view):
        """
        Verifica si el usuario autenticado tiene el rol de 'conductor'.
        """
        return bool(request.user and request.user.is_authenticated and request.user.rol == 'conductor')


class IsAdministradorOrReadOnly(permissions.BasePermission):
    """
    Permite operaciones de escritura solo a administradores.
    Operaciones de lectura a cualquier usuario autenticado.
    """
    def has_permission(self, request, view):
        """
        Verifica si la petición es de lectura o si el usuario es 'administrador' para permitir la escritura.
        """
        if request.method in permissions.SAFE_METHODS:
            return bool(request.user and request.user.is_authenticated)
        return bool(request.user and request.user.is_authenticated and request.user.rol == 'administrador')


class IsOperadorOrAdministrador(permissions.BasePermission):
    """
    Permite acceso a operadores y administradores.
    """
    def has_permission(self, request, view):
        """
        Verifica si el usuario autenticado es 'operador' o 'administrador'.
        """
        return bool(
            request.user and request.user.is_authenticated and 
            request.user.rol in ['operador', 'administrador']
        )
