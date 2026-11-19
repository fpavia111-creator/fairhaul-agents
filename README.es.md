# Agentes de flete Fairhaul

*Traducido por Claude; revisión por hablante nativo pendiente. El [README](README.md) en inglés es la referencia.*

Treinta pequeños agentes MCP para costes de flete y envío. Cada uno se encarga de **una sola tarea**, como auditar una factura de transporte, preparar la provisión de fletes del cierre de mes, liquidar pagos a transportistas o revisar una declaración aduanera, y no puede actuar fuera de ella. Leen los archivos que ya exporta de su TMS, ERP, WMS, portales de transportistas y proveedor EDI, escriben informes en su equipo y esperan a una persona con nombre antes de cualquier cosa que mueva dinero, envíe un mensaje o cambie un sistema en producción.

Licencia MIT · Node 20 o posterior · solo archivos locales · sin credenciales · sin dependencias

## Probar

```bash
npx -y fairhaul-freight-bill-audit demo        # auditoría de facturas de flete con datos ficticios
npx -y fairhaul-freight-accruals demo     # provisión de fletes con datos ficticios
```

Cada agente tiene una `demo` con archivos ficticios, un `eval` con sus propios casos de prueba y un servidor MCP (`npx -y <agent> mcp --root <carpeta>`) para Claude Desktop, Claude Code, Cursor y otros hosts MCP. Por ahora, los nombres de columna y los informes están en inglés.

## Los agentes

**Lo que facturan los transportistas:** `fairhaul-freight-bill-audit` (carga completa y consolidada contra contratos), `fairhaul-parcel-refunds` (paquetería), `fairhaul-detention-and-lumper` (estadías y esperas), `fairhaul-fuel-surcharges` (recargos por combustible), `fairhaul-accessorial-charges` (origen de los servicios adicionales), `fairhaul-ltl-reweighs` (repesajes y cambios de clase), `fairhaul-duplicate-payments` (pagos dobles), `fairhaul-ocean-freight-audit` (marítimo), `fairhaul-air-freight-audit` (aéreo), `fairhaul-proof-of-delivery` (comprobantes de entrega), `fairhaul-container-demurrage` (días libres de contenedores y demoras), `fairhaul-customs-entries` (declaraciones aduaneras contra facturas comerciales, sin asesoría de clasificación).

**Planificar, comprar y operar el flete:** `fairhaul-rfp-bid-scoring` (licitaciones), `fairhaul-contract-rerating` (historial revalorizado con cada contrato), `fairhaul-spot-quotes` (cotizaciones spot), `fairhaul-lane-spend` (gasto por ruta y consolidación), `fairhaul-carrier-scorecards` (cuadros de mando de transportistas), `fairhaul-carrier-vetting` (señales de fraude), `fairhaul-load-tracking` (envíos retrasados), `fairhaul-dock-scheduling` (citas en andén), `fairhaul-carton-sizing` (tamaños de caja), `fairhaul-edi-files` (lectura y conciliación de archivos X12).

**Cierre y costes:** `fairhaul-freight-accruals` (provisión de fletes), `fairhaul-freight-allocation` (flete repartido por pedido y centro de costes), `fairhaul-standard-freight-cost` (estándares de flete en el coste de artículos), `fairhaul-freight-margins` (flete cobrado contra flete real por cliente), `fairhaul-broker-settlements` (pagos a transportistas para brókeres), `fairhaul-freight-claims` (reclamaciones por daños), `fairhaul-returns-tracking` (devoluciones hasta la nota de crédito), `fairhaul-freight-emissions` (estimaciones de emisiones con los factores que usted elija).

## Cómo se mantienen seguros

- **Lista permitida por agente.** Cada agente solo puede llamar a sus propias herramientas.
- **Enmascarado antes de que el modelo lo vea.** Los nombres de destinatarios de paquetes y devoluciones, firmantes, contactos y conductores se vuelven seudónimos (`CU-3f2a9c1d`, `ST-8cea1a2d`); teléfonos, correos y direcciones, marcadores. Los nombres de transportistas y clientes (empresas), los números de carga y de factura, las fechas y los importes se envían tal cual (`--pii strict` oculta también los nombres de empresas). Los archivos escritos en su equipo conservan los valores reales.
- **Herramientas rechazadas.** Pagar, enviar correos, cambiar el TMS, contabilizar en el libro mayor o presentar ante aduanas están nombradas y bloqueadas.
- **Un clic con nombre.** Pagos, envíos, cambios en producción y aprobaciones de asientos esperan a una persona con nombre, incluso en modo Auto, vinculados al sha256 del borrador revisado.
- **Registro de auditoría** en `.fairhaul/`, encadenado por hash, firmado si configura una clave Ed25519.
- **Parada de emergencia:** `<agent> kill` detiene todas las herramientas hasta `<agent> unkill`.

## Cómo se prueban

Cada agente tiene pruebas propias de sus reglas, las mismas pruebas de contrato que todos los demás (argumentos, archivos fuera de `--root`, modo Revisión, parada de emergencia, aprobación de borradores, resultados repetibles) y de 14 a 22 casos de evaluación sobre archivos ficticios. Cada caso con hojas de cálculo se repite como exportación alemana, francesa, española, brasileña, italiana, japonesa, china y coreana, y se insertan datos hostiles en los archivos de cada agente. En total: 953 pruebas y 551 casos de evaluación (revisión final del 19/11/2026 en Windows con Node 24; la CI cubre Node 20 y 22). [REVIEW-ver3.md](REVIEW-ver3.md) (en inglés) enumera los cambios de la versión 2 y los errores encontrados.

## Límites

- Cada agente trabaja solo con los archivos que usted le da y no inicia sesión en ningún sistema de transportista, TMS, ERP, banco u organismo público.
- No es asesoría legal, fiscal, aduanera ni contable. Las personas deciden y actúan.
