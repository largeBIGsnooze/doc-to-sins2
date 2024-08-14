const fs = require('fs')
const path = require('path')
module.exports = class Config {
    static default_settings = { api_key: 'REPLACE_WITH_GOOGLE_SHEETS_API_KEY', sheet_id: 'REPLACE_WITH_SHEET_ID', folder_directory: '', poll_interval: 5000 }
    static settings
    static required_keys = ['api_key', 'sheet_id', 'folder_directory']

    static init() {
        try {
            Config.settings = JSON.parse(fs.readFileSync(path.resolve(__dirname, './../config.json'), 'utf-8'))
            Config.required_keys.forEach((prop) => {
                if (!Config.settings.hasOwnProperty(prop)) {
                    Config.settings[prop] = Config.default_settings[prop]
                }
            })
            Config.save()
        } catch {
            Config.reset()
            Config.save()
        }
    }
    static save() {
        fs.writeFileSync(path.resolve(__dirname, './../config.json'), JSON.stringify(Config.settings, null, 2))
    }
    static reset() {
        Config.settings = { ...Config.default_settings }
    }
}
