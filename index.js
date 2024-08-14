const { app, Tray, dialog, Menu } = require('electron')
const { exec } = require('child_process')
const path = require('path')
const delay = require('./lib/utils/delay')
const Config = require('./lib/config')
const logger = require('./lib/utils/logger')

app.on('ready', () => trayApp())

function trayApp() {
    const tray = new Tray(path.resolve(__dirname, 'favicon.ico'))
    const trayTitle = 'Google Sheets to Sins 2'
    const tooltipState = { idle: ' - Idle', running: ' - Running' }
    tray.setToolTip(trayTitle + tooltipState.idle)
    Config.init()

    let executionTitle = 'Start execution',
        isRunning = false

    const context = () => {
        const template = Menu.buildFromTemplate([
            {
                label: executionTitle,
                type: 'normal',
                click: () => beginExecution(),
            },
            {
                type: 'separator',
            },
            {
                label: 'Open settings',
                type: 'normal',
                click: () => {
                    Config.init()
                    exec(`start ${path.resolve(__dirname, './config.json')}`)
                },
            },
            {
                label: 'Exit application',
                type: 'normal',
                click: () => app.quit(),
            },
        ])
        return template
    }

    const showErrorMessage = (message, detail) => dialog.showMessageBox({ title: 'Error', type: 'error', message: message, detail: detail })

    const poll = async (ms, sheetId, modDirectory, apiKey) => {
        while (isRunning) {
            try {
                await require('./lib/services/gsheet-to-sins2')(sheetId, modDirectory, apiKey)
            } catch (e) {
                console.error(e)
                const message = e.errors[0].message || e.message
                switch (e.code) {
                    case 429:
                        break // Quota exceeded
                    case 403: // Invalid api key
                    case 400: {
                        stopExecution()
                        showErrorMessage('Invalid API Key', message)
                        break
                    }
                    case 404: {
                        // Invalid sheet id
                        stopExecution()
                        showErrorMessage('Invalid Sheet ID', message)
                        break
                    }
                    default: {
                        stopExecution()
                        dialog.showErrorBox('Error', message)
                    }
                }
            }
            await delay(ms || 5000)
        }
    }

    const beginExecution = () => {
        Config.init()
        const _ = Config.settings
        if (executionTitle === 'Start execution') {
            logger.info('Execution started')
            executionTitle = 'Stop execution'
            isRunning = true
            poll(_.poll_interval, _.sheet_id, _.folder_directory, _.api_key)
            tray.setToolTip(trayTitle + tooltipState.running)
        } else {
            executionTitle = 'Start execution'
            isRunning = false
            tray.setToolTip(trayTitle + tooltipState.idle)
            logger.info('Execution stopped')
        }
        tray.setContextMenu(context())
    }

    const stopExecution = () => {
        executionTitle = 'Start execution'
        isRunning = false
        tray.setContextMenu(context())
    }
    tray.setContextMenu(context())
}

if (!app.requestSingleInstanceLock()) app.quit()
else {
    app.on('second-instance', () =>
        dialog.showMessageBox({
            title: 'Information',
            type: 'info',
            message: 'Only a single instance of this application is allowed',
        }),
    )
}

app.on('window-all-closed', () => false)
