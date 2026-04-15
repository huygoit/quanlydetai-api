import env from '#start/env'

const openAlexConfig = {
  baseUrl: env.get('OPENALEX_BASE_URL') || 'https://api.openalex.org',
  apiKey: env.get('OPENALEX_API_KEY') || '',
  mailto: env.get('OPENALEX_MAILTO') || '',
}

export default openAlexConfig
