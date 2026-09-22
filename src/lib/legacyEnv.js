// Back-compat shim: map legacy ARoute (legacy 9Router) env vars to their AROUTE_ names.
// Delete after one major release once users have migrated.
const LEGACY_ENV_MAP = {
  NINEROUTER_URL: "AROUTE_URL",
  NINEROUTER_KEY: "AROUTE_KEY",
  NINEROUTER_PEER_TOKEN: "AROUTE_PEER_TOKEN",
  NINEROUTER_CLI_APP_DIR: "AROUTE_CLI_APP_DIR",
  NINEROUTER_PROXY_CLIENT_MAX_BODY_SIZE: "AROUTE_PROXY_CLIENT_MAX_BODY_SIZE",
  NINE_ROUTER_API_KEY: "AROUTE_API_KEY",
  NINE_ROUTER_PROXY_MANAGED: "AROUTE_PROXY_MANAGED",
  NINE_ROUTER_PROXY_URL: "AROUTE_PROXY_URL",
  NINE_ROUTER_NO_PROXY: "AROUTE_NO_PROXY",
};

export function applyLegacyEnvAliases(env = process.env) {
  for (const [legacy, current] of Object.entries(LEGACY_ENV_MAP)) {
    if (env[legacy] && !env[current]) env[current] = env[legacy];
  }
  return env;
}
