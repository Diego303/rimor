/**
 * Reglas de detección de secretos (CAP-05), adaptadas de gitleaks. Cada regla busca el secreto y, si lleva
 * contexto (una cabecera, un usuario en una URL), marca con el grupo `secreto` solo la parte que se oculta.
 * Ninguna casa con un texto que ya empieza por «‹oculto:», así que ocultar dos veces da lo mismo.
 */

export interface ReglaSecreto {
  id: string;
  /** Tipo que se escribe en la marca: `‹oculto:tipo›`. */
  tipo: string;
  /** Expresión global. Si tiene el grupo con nombre `secreto`, solo se oculta ese grupo. */
  patron: RegExp;
}

const NO_OCULTO = '(?!‹oculto:)';

// «d» da la posición exacta del grupo `secreto`.
const r = (id: string, tipo: string, fuente: string, banderas = 'g'): ReglaSecreto => ({
  id,
  tipo,
  patron: new RegExp(fuente, `${banderas}d`),
});

export const REGLAS_SECRETOS: readonly ReglaSecreto[] = [
  // Claves privadas en PEM (también la de una cuenta de servicio de GCP, que va dentro de su JSON).
  r(
    'clave-privada',
    'clave-privada',
    String.raw`-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z0-9 ]*PRIVATE KEY-----`,
  ),
  // Proveedores de IA (Anthropic y OpenRouter antes que OpenAI, que comparten «sk-»).
  r('anthropic', 'anthropic', String.raw`\bsk-ant-(?:api|admin|oat)\d{2}-[A-Za-z0-9_-]{20,}`),
  r('openrouter', 'openrouter', String.raw`\bsk-or-v1-[a-f0-9]{64}\b`),
  r('openai', 'openai', String.raw`\bsk-(?!ant-|or-)(?:proj-|svcacct-|admin-)?[A-Za-z0-9_-]{32,}`),
  // Nube.
  r('aws-id', 'aws', String.raw`\b(?:AKIA|ASIA|ABIA|ACCA)[A-Z0-9]{16}\b`),
  r(
    'aws-secreto',
    'aws',
    String.raw`(?:aws_secret_access_key|AWS_SECRET_ACCESS_KEY|SecretAccessKey)["']?\s*[:=]\s*["']?(?<secreto>${NO_OCULTO}[A-Za-z0-9/+]{40})(?![A-Za-z0-9/+])`,
  ),
  r('gcp-api', 'gcp', String.raw`\bAIza[0-9A-Za-z_-]{35}(?![0-9A-Za-z_-])`),
  r('azure-almacen', 'azure', `AccountKey=(?<secreto>${NO_OCULTO}[A-Za-z0-9+/]{86}==)`),
  r(
    'azure-cliente',
    'azure',
    String.raw`(?<![A-Za-z0-9_~.-])[A-Za-z0-9_~.]{3}\dQ~[A-Za-z0-9_~.-]{31,34}(?![A-Za-z0-9_~.-])`,
  ),
  // Forjas y mensajería.
  r('github', 'github', String.raw`\b(?:gh[pousr]_[A-Za-z0-9]{36,255}|github_pat_[A-Za-z0-9_]{60,255})\b`),
  r('gitlab', 'gitlab', String.raw`\bglpat-[A-Za-z0-9_-]{20,}`),
  r('slack', 'slack', String.raw`\bxox[abposr]-[A-Za-z0-9-]{10,}`),
  r(
    'slack-webhook',
    'slack',
    String.raw`https://hooks\.slack\.com/services/(?<secreto>${NO_OCULTO}T[A-Z0-9]+/B[A-Z0-9]+/[A-Za-z0-9]+)`,
  ),
  // Tokens genéricos con forma reconocible.
  r('jwt', 'jwt', String.raw`\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}`),
  // Cabeceras Authorization (Bearer, Basic, Token): se oculta el valor, no el esquema.
  r(
    'authorization',
    'authorization',
    String.raw`\bAuthorization["']?\s*[:=]\s*["']?(?:Bearer|Basic|Token|Bot)\s+(?<secreto>${NO_OCULTO}[^\s"',;]+)`,
    'gi',
  ),
  // Contraseñas en URL y cadenas de conexión: esquema://usuario:CONTRASEÑA@host.
  r(
    'contrasena-url',
    'contrasena',
    String.raw`\b[a-z][a-z0-9+.-]*://[^\s:/@'"]+:(?<secreto>${NO_OCULTO}[^\s@/'"]+)@`,
    'gi',
  ),
  // Contraseñas en cadenas de conexión con clave=valor (ADO.NET, JDBC).
  r('contrasena-cadena', 'contrasena', String.raw`\b(?:Password|Pwd)\s*=\s*(?<secreto>${NO_OCULTO}[^;'"\s]+)`, 'gi'),
];
