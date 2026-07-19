const RELEASE_PATTERN = /^release-\d{8}-\d{6}$/;
const SCHEMA_PATTERN = /^\d{14}_[a-z0-9_]+$/;

export function healthIdentity(env: Record<string, string | undefined>) {
  const release = env.APP_RELEASE_ID;
  const schema = env.APP_SCHEMA_MARKER;
  if (!release || !RELEASE_PATTERN.test(release)) {
    throw new Error("APP_RELEASE_ID tidak valid");
  }
  if (!schema || !SCHEMA_PATTERN.test(schema)) {
    throw new Error("APP_SCHEMA_MARKER tidak valid");
  }
  return { release, schema };
}
