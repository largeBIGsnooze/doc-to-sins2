module.exports = class Logger {
    static info(...messages) {
        return console.log('[INFO]:', ...messages)
    }
}
