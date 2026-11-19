# Despliegue automático

La aplicación web se publica en Firebase Hosting, proyecto `imagipic`.

- Cada `push` a `main` inicia el workflow **Deploy to Firebase Hosting on main**.
  Esto incluye tanto los commits enviados directamente como los merges de pull requests.
  Los commits que solo existen en tu equipo todavía no activan GitHub Actions.
- Los pull requests del mismo repositorio dirigidos a `main` generan una URL de
  vista previa. Los de forks se omiten porque no tienen acceso al secreto de Firebase.
- Producción también se puede desplegar desde **Actions → Deploy to Firebase
  Hosting on main → Run workflow**, seleccionando `main`.

Ambos workflows usan Node 22, instalan con `npm ci` desde
`IonicSource/package-lock.json` y compilan con `npm --prefix IonicSource run build`.
Si la instalación o la compilación falla, no se publica la aplicación.
Las publicaciones de producción no se ejecutan simultáneamente. Si llegan varios
pushes durante un despliegue, GitHub puede sustituir la ejecución pendiente por
la del push más reciente.

## Configuración necesaria en GitHub

1. Habilitar GitHub Actions para el repositorio y permitir las acciones utilizadas.
2. En **Settings → Secrets and variables → Actions**, mantener el secreto
   `FIREBASE_SERVICE_ACCOUNT_IMAGIPIC` con el JSON de una cuenta de servicio válida
   del proyecto `imagipic`, con permisos para publicar en Firebase Hosting.
3. Para las vistas previas, permitir que el workflow escriba checks y comentarios
   en pull requests mediante `GITHUB_TOKEN`.
4. Subir los workflows y los cambios de la aplicación necesarios para compilar,
   incluidos `IonicSource/package.json`, su lockfile y los archivos fuente nuevos.

No guardar el JSON de la cuenta de servicio en el repositorio. Si hay que volver a
configurar la integración, ejecutar `firebase init hosting:github` desde un equipo
autenticado con acceso de administrador al repositorio y al proyecto Firebase.

## Verificación de un despliegue

Después de un push a `main`, revisar la ejecución correspondiente en
<https://github.com/Lazuli26/ImagiPIC/actions> y comprobar que **Deploy to production**
terminó correctamente. La aplicación está en <https://imagipic.web.app>.

Estos workflows publican únicamente Hosting. Las reglas e índices de Firestore,
las reglas de Storage y las Cloud Functions se despliegan por separado.
