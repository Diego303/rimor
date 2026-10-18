/**
 * Corpus de secretos falsos (IN-010): cada caso es un texto con su contexto y el secreto que debe desaparecer.
 * Los valores se arman concatenando trozos para que ningún escáner de secretos los tome por reales.
 */

const rep = (c: string, n: number) => c.repeat(n);
const mezcla = (n: number, base = 'aZ3kQ9xT') => Array.from({ length: n }, (_, i) => base[i % base.length]).join('');
const hex = (n: number) => Array.from({ length: n }, (_, i) => '0123456789abcdef'[(i * 7) % 16]).join('');

export interface CasoSecreto {
  texto: string;
  secreto: string;
  regla: string;
}

const casos: [string, string, string][] = [];
const anadir = (regla: string, secreto: string, plantilla: (s: string) => string) =>
  casos.push([regla, secreto, plantilla(secreto)]);

const PEM_RSA = `-----BEGIN ${'RSA PRIVATE'} KEY-----\n${mezcla(64)}\n${mezcla(64, 'Qx9pL2mN')}\n-----END ${'RSA PRIVATE'} KEY-----`;
const PEM_EC = `-----BEGIN ${'EC PRIVATE'} KEY-----\n${mezcla(64, 'MHcCAQEE')}\n-----END ${'EC PRIVATE'} KEY-----`;
const PEM_SSH = `-----BEGIN ${'OPENSSH PRIVATE'} KEY-----\n${mezcla(70, 'b3BlbnNz')}\n-----END ${'OPENSSH PRIVATE'} KEY-----`;
const PEM_PKCS8 = `-----BEGIN ${'PRIVATE'} KEY-----\n${mezcla(64, 'MIIEvQIB')}\n-----END ${'PRIVATE'} KEY-----`;
anadir('clave-privada', PEM_RSA, (s) => `Clave del despliegue:\n${s}\nfin`);
anadir('clave-privada', PEM_EC, (s) => s);
anadir('clave-privada', PEM_SSH, (s) => `cat ~/.ssh/id_ed25519\n${s}`);
anadir('clave-privada', PEM_PKCS8, (s) => `{"type": "service_account", "private_key": "${s.replace(/\n/g, '\\n')}"}`);

anadir('aws-id', `AKIA${'IOSFODNN7'}EXAMPLE`, (s) => `AWS_ACCESS_KEY_ID=${s}`);
anadir('aws-id', `ASIA${rep('Q', 4)}${'ZZRT7'}${rep('X', 7)}`, (s) => `aws configure set aws_access_key_id ${s}`);
anadir('aws-secreto', `wJalrXUtnFEMI/K7MDENG/bPxRfiCY${'EXAMPLEKEY'}`, (s) => `aws_secret_access_key = ${s}`);
anadir('aws-secreto', `${mezcla(20)}/${mezcla(19, 'pQ7rT2vW')}`, (s) => `"SecretAccessKey": "${s}"`);
anadir('gcp-api', `AIza${'Sy'}${mezcla(33)}`, (s) => `const clave = "${s}";`);
anadir('gcp-api', `AIza${mezcla(35, 'Ba9-_kQ2')}`, (s) => `GOOGLE_API_KEY=${s}`);
anadir(
  'azure-almacen',
  `${mezcla(86, 'Ab12+/Cd')}==`,
  (s) => `DefaultEndpointsProtocol=https;AccountName=rimor;AccountKey=${s};EndpointSuffix=core.windows.net`,
);
anadir('azure-cliente', `${'ab1'}8Q~${mezcla(34, 'Kq.~_9Zx')}`, (s) => `AZURE_CLIENT_SECRET=${s}`);

anadir('github', `ghp_${mezcla(36)}`, (s) => `export GITHUB_TOKEN=${s}`);
anadir('github', `gho_${mezcla(36, 'Pz8Lq2Wm')}`, (s) => `token: ${s}`);
anadir('github', `ghs_${mezcla(36, 'Tt4Kk9Rr')}`, (s) => `Authorization header was not used, token ${s} in env`);
anadir(
  'github',
  `github_pat_${mezcla(22)}_${mezcla(59, 'Qr8Zt2Lm')}`,
  (s) => `git clone https://github.com/a/b.git # ${s}`,
);
anadir('gitlab', `glpat-${mezcla(20, 'xY7_zQ3-')}`, (s) => `GITLAB_TOKEN="${s}"`);
anadir('slack', `xoxb-${'1234567890'}-${'0987654321'}-${mezcla(24)}`, (s) => `SLACK_BOT_TOKEN=${s}`);
anadir('slack', `xoxp-${'1111111111'}-${'2222222222'}-${mezcla(32, 'Ab3Cd5Ef')}`, (s) => `slack: ${s}`);
anadir(
  'slack-webhook',
  `T${'00000000'}/B${'11111111'}/${mezcla(24)}`,
  (s) => `curl -X POST https://hooks.slack.com/services/${s} -d '{}'`,
);

anadir('openai', `sk-proj-${mezcla(48)}`, (s) => `OPENAI_API_KEY=${s}`);
anadir('openai', `sk-${mezcla(48, 'T3BlbkFJ')}`, (s) => `openai.api_key = "${s}"`);
anadir('anthropic', `sk-ant-api03-${mezcla(93, 'Zx9_Qw-7')}`, (s) => `ANTHROPIC_API_KEY=${s}`);
anadir('anthropic', `sk-ant-admin01-${mezcla(80, 'Lm2_Np-4')}`, (s) => `{"key":"${s}"}`);
anadir('openrouter', `sk-or-v1-${hex(64)}`, (s) => `OPENROUTER_API_KEY=${s}`);

const JWT = `eyJ${'hbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'}.eyJ${'zdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkFuYSJ9'}.${mezcla(43, 'SflKxwRJ')}`;
anadir('jwt', JWT, (s) => `token=${s}`);
anadir(
  'jwt',
  `eyJ${mezcla(20)}.eyJ${mezcla(30, 'Pq9Wz2Kx')}.${mezcla(20, 'Ux7Yt3Rs')}`,
  (s) => `Cookie: session=${s}; Path=/`,
);

anadir(
  'authorization',
  `${mezcla(32, 'b7Hk2Qz9')}`,
  (s) => `curl -H "Authorization: Bearer ${s}" https://api.ejemplo.org/v1`,
);
anadir('authorization', `${'YW5hOmNsYXZl'}${mezcla(8)}`, (s) => `Authorization: Basic ${s}`);
anadir('authorization', `${mezcla(40, 'Tk4Lm8Np')}`, (s) => `headers: { "Authorization": "Token ${s}" }`);
anadir('authorization', `${mezcla(30, 'Gh5Jk7Lm')}.${mezcla(6)}`, (s) => `authorization: Bot ${s}`);

anadir('contrasena-url', `${'Sup3r'}${'Secr3t'}`, (s) => `DATABASE_URL=postgres://ana:${s}@db.interna:5432/rimor`);
anadir('contrasena-url', `${'m0ng0'}!${'Clave'}`, (s) => `mongodb+srv://admin:${s}@cluster0.example.net/test`);
anadir('contrasena-url', `${'redis'}${'Pass'}99`, (s) => `REDIS_URL=redis://default:${s}@localhost:6379/0`);
anadir('contrasena-url', `${'hunter'}2`, (s) => `git remote add origin https://diego:${s}@git.ejemplo.org/rimor.git`);
anadir('contrasena-url', `${'amqp'}-${'clave'}`, (s) => `amqp://cola:${s}@rabbit:5672/`);
anadir('contrasena-cadena', `${'P4ss'}${'w0rd'}!`, (s) => `Server=sql;Database=rimor;User Id=sa;Password=${s};`);
anadir('contrasena-cadena', `${'jdbc'}${'Clave'}1`, (s) => `jdbc:sqlserver://h:1433;databaseName=x;user=sa;pwd=${s}`);

anadir('gitlab', `glpat-${mezcla(26, 'Nm4-Rt8_')}`, (s) => `git push https://oauth2:${'x'}@gitlab.com/g/p.git # ${s}`);
anadir(
  'aws-id',
  `AKIA${mezcla(16, 'QWERTY23')}`.toUpperCase(),
  (s) => `{"AccessKeyId": "${s}", "Expiration": "2026-10-18"}`,
);
anadir('openai', `sk-svcacct-${mezcla(40, 'Hj6Kl8Zx')}`, (s) => `OPENAI_KEY: ${s}`);
anadir(
  'authorization',
  `${mezcla(36, 'Ya8Ub2Vc')}`,
  (s) => `GET /api HTTP/1.1\r\nHost: x\r\nauthorization: bearer ${s}\r\n`,
);

export const SECRETOS: CasoSecreto[] = casos.map(([regla, secreto, texto]) => ({ regla, secreto, texto }));
