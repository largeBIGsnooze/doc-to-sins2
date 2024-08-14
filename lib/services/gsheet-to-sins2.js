const api = require('./api')
const fs = require('fs')
const path = require('path')
const logger = require('../utils/logger')

class GSheet2Sins2 {
    constructor({ modFolder: modFolder, sheetId: sheetId, apiKey: apiKey }) {
        this.root = modFolder
        this.entityFolder = path.resolve(modFolder, 'entities')
        this.localisationFolder = path.resolve(modFolder, 'localized_text')
        this.sheetId = sheetId
        this.apiKey = apiKey
        this.docData = null
        this.entityContents = null
    }

    async fetchDataFromSheet(document) {
        return api(document, this.sheetId, this.apiKey).then((e) => {
            const headers = e[0]
            const data = e.slice(1)
            return data.map((y) =>
                y.reduce((obj, val, i) => {
                    obj[headers[i]] = val
                    return obj
                }, {}),
            )
        })
    }

    entityExists(entity) {
        return fs.existsSync(path.resolve(this.entityFolder, entity))
    }

    readEntity(entity) {
        const contents = fs.readFileSync(path.resolve(this.entityFolder, entity), 'utf-8')
        if (JSON.parse(contents)) {
            return JSON.parse(contents)
        }
    }

    stringify(json) {
        return JSON.stringify(json, null, 2)
    }

    writeEntity(directory, entity, data) {
        if (!fs.existsSync(path.resolve(directory))) {
            fs.mkdirSync(path.resolve(directory))
        }
        fs.writeFileSync(path.resolve(directory, entity), this.stringify(data))
    }

    insertLocalizedTextFromDirectory(data) {
        const postfix = { name: '_name', description: '_description' }
        const obj = {}
        for (const prop of data) {
            obj[prop.Filename + postfix.name] = prop.LocName
            obj[prop.Filename + postfix.description] = prop.LocDescription
        }
        this.writeEntity(this.localisationFolder, 'en.localized_text', obj)
    }

    insertEntityDataFromDirectory(entities, data) {
        const entityDir = fs.readdirSync(this.entityFolder).filter((e) => e.endsWith('.unit'))
        entityDir.forEach((file) => {
            const name = path.basename(file, '.unit')
            const entity = entities.find((e) => name === e.Filename || name.endsWith(e.Filename?.replace('<race>', '')))

            if (entity) this.docData = entity
            else this.docData = entities.find((e) => name.endsWith(e.Filename?.replace('<race>', '')))

            this.entityContents = this.readEntity(file)
            this.updateProperties(data)

            this.writeEntity(this.entityFolder, file, this.entityContents)
        })
    }

    updateProperties(properties) {
        for (const prop of properties) {
            const keys = prop.split('.')
            const value = parseFloat(this.docData[keys[keys.length - 1]] || 0)
            let current = this.entityContents

            for (const key of keys.slice(0, -1)) {
                if (!current[key]) current[key] = {}
                current = current[key]
            }
            current[keys[keys.length - 1]] = value
        }
    }

    createEntitiesByName(docEntities) {
        for (const entity of docEntities) {
            if (this.entityExists(`${entity.Filename}.unit`) || !entity.Filename) continue

            if (entity.Filename.startsWith('<race>')) {
                for (const race of ['amarr', 'gallente', 'minmatar', 'caldari']) {
                    const entityName = `${race}${/<race>(.*)/.exec(entity.Filename)[1]}`
                    this.writeEntity(this.entityFolder, entityName + '.unit', {})
                }
                continue
            }
            this.writeEntity(this.entityFolder, entity.Filename + '.unit', {})
        }
        logger.info('Entities generated')
    }
}

let prevMergedObjs = {}

module.exports = async function main(sheetId, modDirectory, apiKey) {
    const queryInterface = {
        basic: 'Ships (Basic)!C:P',
        tank: 'Ships (Tank)!C:P',
        navigation: 'Ships (Navigation)!C:P',
        industry: 'Ships (Industry)!C:P',
        localisation: 'Ships (Strings)!C:P',
    }
    const GSheet = new GSheet2Sins2({ modFolder: modDirectory, sheetId: sheetId, apiKey: apiKey })

    const unitData = ['physics.max_linear_speed', 'physics.max_angular_speed', 'physics.time_to_max_linear_speed', 'physics.time_to_max_angular_speed', 'physics.linear_acceleration_angle', 'physics.max_bank_angle']

    const [shipBasic, shipNavigation, shipTank, shipLocal] = await Promise.all([await GSheet.fetchDataFromSheet(queryInterface.basic), await GSheet.fetchDataFromSheet(queryInterface.navigation), await GSheet.fetchDataFromSheet(queryInterface.tank), await GSheet.fetchDataFromSheet(queryInterface.localisation)])

    let mergedObjs = shipBasic.map((obj, i) => ({ ...obj, ...shipNavigation[i], ...shipTank[i], ...shipLocal[i] }))

    if (JSON.stringify(prevMergedObjs) !== JSON.stringify(mergedObjs)) {
        logger.info('Data changed, updating entities')
        prevMergedObjs = mergedObjs

        GSheet.createEntitiesByName(prevMergedObjs)
        GSheet.insertEntityDataFromDirectory(prevMergedObjs, unitData)
        GSheet.insertLocalizedTextFromDirectory(prevMergedObjs)
    } else {
        logger.info('No changes, idling')
    }
}
