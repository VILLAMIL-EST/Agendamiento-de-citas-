class ApiSinCsrfMiddleware:
    """
    Las rutas /api/ se autentican con JWT, no con la cookie de sesión.

    El refresh token va en cookie HttpOnly con SameSite=Lax, así que un sitio
    externo no la adjunta en un POST. El panel /admin/ conserva la protección CSRF.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.path.startswith('/api/'):
            request._dont_enforce_csrf_checks = True
        return self.get_response(request)
