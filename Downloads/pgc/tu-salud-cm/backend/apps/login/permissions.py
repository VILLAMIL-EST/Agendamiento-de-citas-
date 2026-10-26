from rest_framework.permissions import BasePermission


class IsPaciente(BasePermission):
    message = 'Esta acción solo está disponible para pacientes.'

    def has_permission(self, request, view):
        usuario = request.user
        return bool(usuario and usuario.is_authenticated and usuario.is_patient)


class IsMedico(BasePermission):
    message = 'Esta acción solo está disponible para el personal médico.'

    def has_permission(self, request, view):
        usuario = request.user
        return bool(usuario and usuario.is_authenticated and usuario.is_doctor)


class IsMedicoOAdmin(BasePermission):
    message = 'Esta acción solo está disponible para el personal médico o administración.'

    def has_permission(self, request, view):
        usuario = request.user
        return bool(
            usuario
            and usuario.is_authenticated
            and (usuario.is_doctor or usuario.is_admin)
        )


class IsAdmin(BasePermission):
    message = 'Esta acción solo está disponible para administración.'

    def has_permission(self, request, view):
        usuario = request.user
        return bool(usuario and usuario.is_authenticated and usuario.is_admin)
