let { driver } = require("gremlin");
const async = require("async");
let conn;

export const runNeptuneQuery = async (conn, gremlinTemplate) => {
    return async.retry(
      {
        times: 5,
        interval: 1000,
        errorFilter: function (err) {
  
          // Add filters here to determine whether error can be retried
          console.warn('determining whether retriable error: ' + err.message);
  
          // Check for connection issues
          if (err.message.startsWith('WebSocket is not open')) {
            console.warn('reopening connection');
            conn.close();
            conn = createRemoteConnection();
            return true;
          }
  
          // Check for ConcurrentModificationException
          if (err.message.includes('ConcurrentModificationException')) {
            console.warn('retrying query because of "ConcurrentModificationException"');
            return true;
          }
  
          // Check for ReadOnlyViolationException
          if (err.message.includes('ReadOnlyViolationException')) {
            console.warn('retrying query because of "ReadOnlyViolationException"');
            return true;
          }
  
          return false;
        }
      },
      async () => {
        return await doQuery(gremlinTemplate)
      });
  }
  
  const getConnectionDetails = () => {
    const neptuneEnv = { // Todo: set neptuneEnv for time being.
      NEPTUNE_PORT: process.env.NEPTUNE_PORT,
      NEPTUNE_ENDPOINT: process.env.NEPTUNE_ENDPOINT
    }
    console.log("neptuneEnv", neptuneEnv);
    const database_url = 'wss://' + neptuneEnv.NEPTUNE_ENDPOINT + ':' + neptuneEnv.NEPTUNE_PORT + '/gremlin';
    return { url: database_url, headers: {} };
  };
  
  const createRemoteConnection = () => {
    const { url, headers } = getConnectionDetails();
    const c = new driver.Client(url,
      {
        mimeType: 'application/vnd.gremlin-v2.0+json',
        headers: headers
      })
  
    return c;
  };
  
  async function doQuery(query) {
    const result = await conn.submit(query);
    return result;
  }
  
 