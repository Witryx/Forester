function webOrigin(value: string) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol))
    throw new Error('APP_ORIGIN musí být HTTP nebo HTTPS adresa.');
  return url.origin;
}

export function resolveOrigins(configured?: string, env: NodeJS.ProcessEnv = process.env) {
  // Only deployment metadata supplied by Vercel is trusted, never request headers.
  const vercelHosts =
    env.VERCEL === '1'
      ? [
          ...(env.VERCEL_ENV === 'production' ? [env.VERCEL_PROJECT_PRODUCTION_URL] : []),
          env.VERCEL_URL,
        ].filter((host): host is string => !!host)
      : [];
  const deploymentOrigins = vercelHosts.map((host) => webOrigin(`https://${host}`));
  const origin = webOrigin(configured || deploymentOrigins[0] || 'http://localhost:5173');
  return { origin, allowedOrigins: new Set([origin, ...deploymentOrigins]) };
}
