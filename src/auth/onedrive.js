import config from '../config/default'

/**
 * Get access token for microsoft graph API endpoints. Refresh token if needed.
 */
export async function getAccessToken() {
  const timestamp = () => {
    return Math.floor(Date.now() / 1000)
  }

  let refresh_token = await (
   await fetch(`https://cy-onedrive.firebaseio.com/refresh_token.json?auth=${FIREBASE_TOKEN}`)).text()

  refresh_token = refresh_token.slice(1, refresh_token.length - 1)
  
  // Fetch access token from Google Firebase Database
  const data = await (await fetch(`${config.firebase_url}?auth=${FIREBASE_TOKEN}`)).json()
  if (data && data.access_token && timestamp() < data.expire_at) {
    console.log('Fetched token from storage.')
    return data.access_token
  }

  // Need refreshing, fetch new access token from Microsoft OneDrive API
  // > add CN API option bellow, activate this at `src/auth/onedrive.js`
  const oneDriveAuthEndpoint = config.useOneDriveCN
    ? 'https://login.chinacloudapi.cn/common/oauth2/v2.0/token'
    : 'https://login.microsoftonline.com/common/oauth2/v2.0/token'

  const params = {
    method: 'POST',
    body: `client_id=${config.client_id}&redirect_uri=${config.redirect_uri}&client_secret=${config.client_secret}&refresh_token=${refresh_token}&grant_type=refresh_token`,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  }

  const resp = await fetch(oneDriveAuthEndpoint, params)

  if (resp.ok) {
    console.info('Successfully refreshed access_token.')
    const data = await resp.json()

    // Update expiration time at Google Firebase on token refresh
    data.expire_at = timestamp() + data.expires_in

    const store = await fetch(`${config.firebase_url}?auth=${FIREBASE_TOKEN}`, {
      method: 'PUT',
      body: JSON.stringify(data),
      headers: {
        'content-type': 'application/json'
      }
    })
    console.log(store.status)

    // Finally, return access token
    return data.access_token
  } else {
    // eslint-disable-next-line no-throw-literal
    throw `getAccessToken error ${JSON.stringify(await resp.text())}`
  }
}
