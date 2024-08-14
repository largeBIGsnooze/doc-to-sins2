const { google } = require('googleapis')

module.exports = async (query, sheetId, apiKey) => {
    const sheets = google.sheets({ version: 'v4' })
    const doc = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: query, key: apiKey })
    return doc.data.values
}
