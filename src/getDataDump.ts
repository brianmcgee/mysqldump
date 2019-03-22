import * as fs from 'fs'
import * as mysql from 'mysql2'
import * as sqlformatter from 'sql-formatter'
import { all as merge } from 'deepmerge'

import {
    ConnectionOptions,
    DataDumpOptions,
    FakerColumnOptions,
    FakerOptions
} from './interfaces/Options'
import Table from './interfaces/Table'
import typeCast from './typeCast'

import * as faker from 'faker';


interface QueryRes {
    [k : string] : any
}

function buildInsert(table : Table, values : string[], format : (s : string) => string) {
    const sql = format([
        `INSERT INTO \`${table.name}\` (\`${table.columnsOrdered.join('`,`')}\`)`,
        `VALUES ${values.join(',')};`,
    ].join(' '))

    // sql-formatter lib doesn't support the X'aaff' or b'01010' literals, and it adds a space in and breaks them
    // this undoes the wrapping we did to get around the formatting
    return sql.replace(/NOFORMAT_WRAP\("##(.+?)##"\)/g, '$1')
}
function buildInsertValue(row : QueryRes, table : Table, fakerOptions?: FakerOptions) {

    const tableOptions = fakerOptions ? fakerOptions.replacements[table.name] : undefined;

    return `(${table.columnsOrdered.map(c => {
        
        let value = row[c]
        
        if(tableOptions && tableOptions[c]) {
            
            const columnOptions = tableOptions[c]
            
            let algorithm: string
            
            if(typeof columnOptions === 'string') {
                algorithm = columnOptions as string
            } else {
                const opts = columnOptions as FakerColumnOptions
                algorithm = opts.algorithm
            }
            
			if (algorithm.startsWith('replace:')) {
				// allowing a hardcoded value				
				value = algorithm.split(':')[1]
			} else if (algorithm.startsWith('email')) {
				// added more random username generator

				//We add the option to avoid certain values
				let exclude = algorithm.split(":")[1];
				exclude = exclude.replace("exclude[", "");
				exclude = exclude.replace("]", "");
				let exclusions = exclude.split(",");
				if (exclusions.indexOf(value) >= 0)
					return value;
				value =
					faker.internet.email(faker.name.firstName() + faker.random.number(9999), faker.name.lastName()).toLowerCase();

			} else if (algorithm.startsWith('username')) {
				// added more random email generator

				//We add the option to avoid certain values
				let exclude = algorithm.split(":")[1];
				exclude = exclude.replace("exclude[", "");
				exclude = exclude.replace("]", "");
				let exclusions = exclude.split(",");
				if (exclusions.indexOf(value) >= 0)
					return value;

				value = faker.internet.userName().toLocaleLowerCase + "_" + faker.random.number(9999)
            } else {
                value = faker
                    .fake(`{{${algorithm}}}`)
                    .replace(/'/g, "\\'")
            }
            
            
            value = `'${value}'`
        }
        
        return value;
    }).join(',')})`
}

export default async function getDataDump(
    connectionOptions : ConnectionOptions,
    options : Required<DataDumpOptions>,
    tables : Table[],
    dumpToFile : string | null,
) {

    // setup faker
    if(options.faker && options.faker.locale) {
        const f = faker as any;
        f['locale'] = options.faker.locale;
    }

    // ensure we have a non-zero max row option
    options.maxRowsPerInsertStatement = Math.max(options.maxRowsPerInsertStatement, 0)

    // clone the array
    tables = [...tables]

    // build the format function if requested
    const format = options.format
        ? (sql : string) => sqlformatter.format(sql)
        : (sql : string) => sql

    // we open a new connection with a special typecast function for dumping data
    const connection = mysql.createConnection(merge<any>([connectionOptions, {
        multipleStatements: true,
        typeCast: typeCast(tables),
    }]))

    const retTables : Table[] = []
    let currentTableLines : string[] | null = []

    // open the write stream (if configured to)
    const outFileStream = dumpToFile ? fs.createWriteStream(dumpToFile, {
        flags: 'a', // append to the file
        encoding: 'utf8',
    }) : null

    function saveChunk(str : string | string[], inArray = true) {
        if (!Array.isArray(str)) {
            str = [str]
        }

        // write to file if configured
        if (outFileStream) {
            str.forEach(s => outFileStream.write(`${s}\n`))
        }

        // write to memory if configured
        if (inArray && currentTableLines) {
            currentTableLines.push(...str)
        }
    }

    // to avoid having to load an entire DB's worth of data at once, we select from each table individually
    // note that we use async/await within this loop to only process one table at a time (to reduce memory footprint)
    while (tables.length > 0) {
        const table = tables.shift()!

        if (table.isView && !options.includeViewData) {
            // don't dump data for views
            retTables.push(merge<Table>([table, {
                data: null,
            }]) as Table)

            // eslint-disable-next-line no-continue
            continue
        }

        currentTableLines = options.returnFromFunction ? [] : null

        if (retTables.length > 0) {
            // add a newline before the next header to pad the dumps
            saveChunk('')
        }

        // write the table header to the file
        const header = [
            '# ------------------------------------------------------------',
            `# DATA DUMP FOR TABLE: ${table.name}`,
            '# ------------------------------------------------------------',
            '',
        ]
        saveChunk(header)

        // eslint-disable-next-line no-await-in-loop
        await new Promise((resolve, reject) => {
            // send the query
            const where = options.where[table.name] ? ` WHERE ${options.where[table.name]}` : ''
            const query = connection.query(`SELECT * FROM \`${table.name}\`${where}`)

            let rowQueue : string[] = []

            // stream the data to the file
            query.on('result', (row : QueryRes) => {

                // build the values list
                rowQueue.push(buildInsertValue(row, table, options.faker))

                // if we've got a full queue
                if (rowQueue.length === options.maxRowsPerInsertStatement) {
                    // create and write a fresh statement
                    const insert = buildInsert(table, rowQueue, format)
                    saveChunk(insert)
                    rowQueue = []
                }
            })
            query.on('end', () => {
                // write the remaining rows to disk
                if (rowQueue.length > 0) {
                    const insert = buildInsert(table, rowQueue, format)
                    saveChunk(insert)
                    rowQueue = []
                }

                resolve()
            })
            query.on('error', /* istanbul ignore next */err => reject(err))
        })

        // update the table definition
        retTables.push(merge<Table>([table, {
            data: currentTableLines ? currentTableLines.join('\n') : null,
        }]))
    }

    saveChunk('')

    // clean up our connections
    await connection.end()

    if (outFileStream) {
        // tidy up the file stream, making sure writes are 100% flushed before continuing
        await new Promise((resolve) => {
            outFileStream.once('finish', () => {
                resolve()
            })
            outFileStream.end()
        })
    }

    return retTables
}
