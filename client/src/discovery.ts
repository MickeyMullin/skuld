// client/src/discovery.ts

export const DISCOVERY_URL = 'https://ghostwolf.home.vorheim.com'

export const isDevServer = import.meta.env.DEV === true

const FORCE_PARAM = 'discovery'
const FORCE_VALUE = '1'

// dev is an injectable param (not a closed-over read of isDevServer) so the
// live branch is exercisable from tests without a production build
export const showDiscoveryLink = (
  search: string = window.location.search,
  dev: boolean = isDevServer,
): boolean => !dev || new URLSearchParams(search).get(FORCE_PARAM) === FORCE_VALUE
