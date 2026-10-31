# CRM Comercial para Agentes de Seguros — Etapa 1

## Qué incluye
- Tablero Kanban de cuatro etapas (Por llamar, Cotizando, Reunión agendada, Por cerrar).
- Alta y edición de prospectos, sin requerir producto ni prima.
- Ficha con datos, enlace para llamada y WhatsApp, y registro cronológico de gestiones.
- Próximo contacto, agenda, búsqueda por prospecto y filtro por producto.
- Cierres ganados/perdidos y métricas generales individuales.
- Diseño adaptable a teléfono y computadora.
- Modo demostración local sin conexión a Firebase; modo real con Firebase Authentication y Firestore.

## A. Probarlo inmediatamente
1. Abre la carpeta con VS Code.
2. Instala o usa una extensión tipo Live Server y abre `index.html` en servidor local.
3. No completes `firebase-config.js` todavía. Podrás usar el CRM de demostración.
4. Los registros de demostración están en localStorage de ese navegador: NO se sincronizan y NO deben considerarse una copia de seguridad. No uses datos reales sensibles en la demostración.

## B. Activar Firebase gratis (Spark)
1. Crea proyecto en https://console.firebase.google.com/ en plan Spark (gratuito, sin facturación).
2. Agrega una aplicación Web en Configuración del proyecto > Tus aplicaciones y copia sus propiedades a `firebase-config.js`.
3. En Authentication > Sign-in method activa **Correo/contraseña**.
4. En Authentication > Users crea manualmente tu primera cuenta de agente, con correo y contraseña. El alta de usuarios desde el CRM corresponde a la segunda etapa.
5. Crea una base de datos Cloud Firestore **Standard** y selecciona modo de producción.
6. Copia `firestore.rules` al editor de reglas de Firestore y publícalas, o despliega con Firebase CLI. Estas reglas solo permiten que cada usuario lea/edite sus propios prospectos.
7. Con el archivo `firebase-config.js` completo, recarga el sitio. Aparecerá el login y tus datos se guardarán en Firestore.
8. Importante: al pasar de modo local a Firebase, los datos locales NO se migran automáticamente.

## C. Publicar en Firebase Hosting
Requiere Node.js y la CLI de Firebase, gratuitas.

```sh
npm install -g firebase-tools
firebase login
firebase use --add
firebase deploy --only hosting,firestore:rules
```

La primera vez, selecciona el proyecto creado. `firebase.json` ya está incluido. Abre la URL `web.app` que devuelve Firebase.

## Seguridad y alcance
- En el modo Firebase, el usuario debe iniciar sesión mediante Authentication. No hay registro público de nuevos agentes.
- Cada documento tiene `ownerUid` y las reglas de Firestore comprueban que coincida con el usuario autenticado. Nunca uses reglas `allow read, write: if true`.
- Esta versión almacena las gestiones como arreglo dentro del prospecto: adecuada para una primera etapa de uso moderado. Para auditoría robusta y reportes grandes, la etapa 2 llevará gestiones a subcolecciones inmutables, con políticas específicas.
- El diseño está preparado para ampliar roles en la siguiente etapa, pero el panel administrativo, usuarios creados dentro del CRM y los reportes por agente todavía NO están implementados.
- Evita cargar datos personales sensibles durante pruebas y verifica las obligaciones de privacidad aplicables.

## Etapa 2 recomendada
Roles administrador/supervisor/agente, alta y baja de agentes, asignación de prospectos, reportes de productividad, estadísticas por periodo, historial de actividades y protección de cambios.
