'use strict';

var fs = require('fs');
var deepmerge = require('deepmerge');
var sqlformatter = require('sql-formatter');
var mysql = require('mysql2');
var sqlstring = require('sqlstring');
var faker = require('faker');
var mysql$1 = require('mysql2/promise');

/*! *****************************************************************************
Copyright (c) Microsoft Corporation. All rights reserved.
Licensed under the Apache License, Version 2.0 (the "License"); you may not use
this file except in compliance with the License. You may obtain a copy of the
License at http://www.apache.org/licenses/LICENSE-2.0

THIS CODE IS PROVIDED ON AN *AS IS* BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, EITHER EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION ANY IMPLIED
WARRANTIES OR CONDITIONS OF TITLE, FITNESS FOR A PARTICULAR PURPOSE,
MERCHANTABLITY OR NON-INFRINGEMENT.

See the Apache Version 2.0 License for specific language governing permissions
and limitations under the License.
***************************************************************************** */
/* global Reflect, Promise */













function __awaiter(thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
}

function getTables(connection, dbName, restrictedTables, restrictedTablesIsBlacklist) {
    return __awaiter(this, void 0, void 0, function* () {
        // list the tables
        const showTablesKey = `Tables_in_${dbName}`;
        const tablesRes = (yield connection.query(`SHOW FULL TABLES FROM \`${dbName}\``));
        const actualTables = tablesRes.map(r => ({
            name: r[showTablesKey].replace(/'/g, ''),
            schema: null,
            data: null,
            isView: r.Table_type === 'VIEW',
            columns: {},
            columnsOrdered: [],
            triggers: [],
        }));
        let tables = actualTables;
        if (restrictedTables.length > 0) {
            if (restrictedTablesIsBlacklist) {
                // exclude the tables from the options that actually exist in the db
                tables = tables.filter(t => restrictedTables.indexOf(t.name) === -1);
            }
            else {
                // only include the tables from the options that actually exist in the db
                tables = tables.filter(t => restrictedTables.indexOf(t.name) !== -1);
            }
        }
        // get the column definitions
        const columnsMultiQuery = tables.map(t => `SHOW COLUMNS FROM \`${t.name}\` FROM \`${dbName}\`;`).join('\n');
        const columns = (yield connection.multiQuery(columnsMultiQuery));
        columns.forEach((cols, i) => {
            tables[i].columns = cols.reduce((acc, c) => {
                acc[c.Field] = {
                    type: c.Type
                        // split to remove things like 'unsigned' from the string
                        .split(' ')[0]
                        // split to remove the lengths
                        .split('(')[0]
                        .toLowerCase(),
                    nullable: c.Null === 'YES',
                };
                return acc;
            }, {});
            tables[i].columnsOrdered = cols.map(c => c.Field);
        });
        return tables;
    });
}

function isCreateView(v) {
    return 'View' in v;
}
function getSchemaDump(connection, options, tables) {
    return __awaiter(this, void 0, void 0, function* () {
        const format$$1 = options.format
            ? (sql) => sqlformatter.format(sql)
            : (sql) => sql;
        // we create a multi query here so we can query all at once rather than in individual connections
        const getSchemaMultiQuery = tables.map(t => `SHOW CREATE TABLE \`${t.name}\`;`).join('\n');
        const createStatements = (yield connection.multiQuery(getSchemaMultiQuery))
            // mysql2 returns an array of arrays which will all have our one row
            .map(r => r[0])
            .map((res, i) => {
            const table = tables[i];
            if (isCreateView(res)) {
                return Object.assign({}, table, { name: res.View, schema: format$$1(res['Create View']), data: null, isView: true });
            }
            return Object.assign({}, table, { name: res.Table, schema: format$$1(res['Create Table']), data: null, isView: false });
        })
            .map((s) => {
            // clean up the generated SQL as per the options
            if (!options.autoIncrement) {
                s.schema = s.schema.replace(/AUTO_INCREMENT\s*=\s*\d+ /g, '');
            }
            if (!options.engine) {
                s.schema = s.schema.replace(/ENGINE\s*=\s*\w+ /, '');
            }
            if (s.isView) {
                if (options.view.createOrReplace) {
                    s.schema = s.schema.replace(/^CREATE/, 'CREATE OR REPLACE');
                }
                if (!options.view.algorithm) {
                    s.schema = s.schema.replace(/^CREATE( OR REPLACE)? ALGORITHM[ ]?=[ ]?\w+/, 'CREATE$1');
                }
                if (!options.view.definer) {
                    s.schema = s.schema.replace(/^CREATE( OR REPLACE)?( ALGORITHM[ ]?=[ ]?\w+)? DEFINER[ ]?=[ ]?.+?@.+?( )/, 'CREATE$1$2$3');
                }
                if (!options.view.sqlSecurity) {
                    s.schema = s.schema.replace(
                    // eslint-disable-next-line max-len
                    /^CREATE( OR REPLACE)?( ALGORITHM[ ]?=[ ]?\w+)?( DEFINER[ ]?=[ ]?.+?@.+)? SQL SECURITY (?:DEFINER|INVOKER)/, 'CREATE$1$2$3');
                }
            }
            else {
                if (options.table.dropIfExist) {
                    s.schema = s.schema.replace(/^CREATE TABLE/, `DROP TABLE IF EXISTS \`${s.name}\`;\nCREATE TABLE`);
                }
                else if (options.table.ifNotExist) {
                    s.schema = s.schema.replace(/^CREATE TABLE/, 'CREATE TABLE IF NOT EXISTS');
                }
                if (options.table.charset === false) {
                    s.schema = s.schema.replace(/( )?(DEFAULT )?(CHARSET|CHARACTER SET) = \w+/, '');
                }
            }
            // fix up binary/hex default values if formatted
            if (options.format) {
                s.schema = s.schema
                    // fix up binary and hex strings
                    .replace(/DEFAULT b '(\d+)'/g, 'DEFAULT b\'$1\'')
                    .replace(/DEFAULT X '(\d+)'/g, 'DEFAULT X\'$1\'')
                    // fix up set defs which get split over two lines and then cause next lines to be extra indented
                    .replace(/\n {2}set/g, ' set')
                    .replace(/ {4}/g, '  ');
            }
            // add a semicolon to separate schemas
            s.schema += ';';
            // pad the sql with a header
            s.schema = [
                '# ------------------------------------------------------------',
                `# SCHEMA DUMP FOR TABLE: ${s.name}`,
                '# ------------------------------------------------------------',
                '',
                s.schema,
                '',
            ].join('\n');
            return s;
        });
        return createStatements;
    });
}

/* eslint-enable camelcase */
function getTriggerDump(connection, dbName, options, tables) {
    return __awaiter(this, void 0, void 0, function* () {
        const triggers = (yield connection.query(`SHOW TRIGGERS FROM \`${dbName}\``))
            // only include triggers from the tables that we have
            .filter(trig => tables.some(t => t.name === trig.Table))
            // convert to a trigger name => table index map for easy lookup
            .reduce((acc, trig) => {
            tables.some((t, i) => {
                if (t.name === trig.Table) {
                    acc.set(trig.Trigger, i);
                    return true;
                }
                return false;
            });
            return acc;
        }, new Map());
        if (triggers.size === 0) {
            // no triggers to process
            return tables;
        }
        // we create a multi query here so we can query all at once rather than in individual connections
        const getSchemaMultiQuery = [];
        triggers.forEach((_, t) => getSchemaMultiQuery.push(`SHOW CREATE TRIGGER \`${t}\`;`));
        const result = yield connection.multiQuery(getSchemaMultiQuery.join('\n'));
        // mysql2 returns an array of arrays which will all have our one row
        result.map(r => r[0])
            .forEach((res) => {
            const table = tables[triggers.get(res.Trigger)];
            // clean up the generated SQL
            let sql = `${(res['SQL Original Statement'])}`;
            if (!options.definer) {
                sql = sql.replace(/CREATE DEFINER=.+?@.+? /, 'CREATE ');
            }
            // add the delimiter in case it's a multi statement trigger
            if (options.delimiter) {
                sql = `DELIMITER ${options.delimiter}\n${sql}${options.delimiter}\nDELIMITER ;`;
            }
            else {
                // else just add a semicolon
                sql = `${sql};`;
            }
            // drop trigger statement should go outside the delimiter mods
            if (options.dropIfExist) {
                sql = `DROP TRIGGER IF EXISTS ${res.Trigger};\n${sql}`;
            }
            // add a header to the trigger
            sql = [
                '# ------------------------------------------------------------',
                `# TRIGGER DUMP FOR: ${res.Trigger}`,
                '# ------------------------------------------------------------',
                '',
                sql,
                '',
            ].join('\n');
            table.triggers.push(sql);
            return table;
        });
        return tables;
    });
}

const numberTypes = new Set([
    'integer',
    'int',
    'smallint',
    'tinyint',
    'mediumint',
    'bigint',
    'decimal',
    'numeric',
    'float',
    'double',
    'real',
]);
const stringTypes = new Set([
    'date',
    'datetime',
    'timestamp',
    'time',
    'year',
    'char',
    'varchar',
    'text',
    'mediumtext',
    'longtext',
    'tinytext',
    'set',
    'enum',
]);
const bitTypes = new Set([
    'bit',
]);
const hexTypes = new Set([
    'blob',
    'tinyblob',
    'mediumblob',
    'longblob',
    'binary',
    'varbinary',
]);
const geometryTypes = new Set([
    'point',
    'linestring',
    'polygon',
    'multipoint',
    'multilinestring',
    'multipolygon',
    'geometrycollection',
]);
function resolveType(columnType) {
    if (numberTypes.has(columnType)) {
        return 'NUMBER';
    }
    if (stringTypes.has(columnType)) {
        return 'STRING';
    }
    if (hexTypes.has(columnType)) {
        return 'HEX';
    }
    if (geometryTypes.has(columnType)) {
        return 'GEOMETRY';
    }
    /* istanbul ignore else */ // shouldn't ever happen
    if (bitTypes.has(columnType)) {
        return 'BIT';
    }
    /* istanbul ignore next */ // shouldn't ever happen
    throw new Error(`UNKNOWN TYPE "${columnType}"`);
}

// adapted from https://github.com/mysqljs/mysql/blob/master/lib/protocol/Parser.js
// changes:
// - cleaned up to use const/let + types
// - reduced duplication
// - made it return a string rather than an object/array
function parseGeometryValue(buffer) {
    let offset = 4;
    const geomConstructors = {
        1: 'POINT',
        2: 'LINESTRING',
        3: 'POLYGON',
        4: 'MULTIPOINT',
        5: 'MULTILINESTRING',
        6: 'MULTIPOLYGON',
        7: 'GEOMETRYCOLLECTION',
    };
    function readDouble(byteOrder) {
        /* istanbul ignore next */ // ignore coverage for this line as it depends on internal db config
        const val = byteOrder ? buffer.readDoubleLE(offset) : buffer.readDoubleBE(offset);
        offset += 8;
        return val;
    }
    function readUInt32(byteOrder) {
        /* istanbul ignore next */ // ignore coverage for this line as it depends on internal db config
        const val = byteOrder ? buffer.readUInt32LE(offset) : buffer.readUInt32BE(offset);
        offset += 4;
        return val;
    }
    // eslint-disable-next-line complexity
    function parseGeometry() {
        let result = [];
        const byteOrder = buffer.readUInt8(offset);
        offset += 1;
        const wkbType = readUInt32(byteOrder);
        switch (wkbType) {
            case 1: { // WKBPoint - POINT(1 1)
                const x = readDouble(byteOrder);
                const y = readDouble(byteOrder);
                result.push(`${x} ${y}`);
                break;
            }
            case 2: { // WKBLineString - LINESTRING(0 0,1 1,2 2)
                const numPoints = readUInt32(byteOrder);
                result = [];
                for (let i = numPoints; i > 0; i -= 1) {
                    const x = readDouble(byteOrder);
                    const y = readDouble(byteOrder);
                    result.push(`${x} ${y}`);
                }
                break;
            }
            case 3: { // WKBPolygon - POLYGON((0 0,10 0,10 10,0 10,0 0),(5 5,7 5,7 7,5 7, 5 5))
                const numRings = readUInt32(byteOrder);
                result = [];
                for (let i = numRings; i > 0; i -= 1) {
                    const numPoints = readUInt32(byteOrder);
                    const line = [];
                    for (let j = numPoints; j > 0; j -= 1) {
                        const x = readDouble(byteOrder);
                        const y = readDouble(byteOrder);
                        line.push(`${x} ${y}`);
                    }
                    result.push(`(${line.join(',')})`);
                }
                break;
            }
            case 4: // WKBMultiPoint
            case 5: // WKBMultiLineString
            case 6: // WKBMultiPolygon
            case 7: { // WKBGeometryCollection - GEOMETRYCOLLECTION(POINT(1 1),LINESTRING(0 0,1 1,2 2,3 3,4 4))
                const num = readUInt32(byteOrder);
                result = [];
                for (let i = num; i > 0; i -= 1) {
                    let geom = parseGeometry();
                    // remove the function name from the sub geometry declaration from the multi declaration
                    // eslint-disable-next-line default-case
                    switch (wkbType) {
                        case 4: // WKBMultiPoint
                            // multipoint = MULTIPOINT(\d+ \d+, \d+ \d+....)
                            geom = geom.replace(/POINT\((.+)\)/, '$1');
                            break;
                        case 5: // WKBMultiLineString
                            geom = geom.replace('LINESTRING', '');
                            break;
                        case 6: // WKBMultiPolygon
                            geom = geom.replace('POLYGON', '');
                            break;
                    }
                    result.push(geom);
                }
                break;
            }
            /* istanbul ignore next */ // this case shouldn't happen ever
            default:
                throw new Error(`Unexpected WKBGeometry Type: ${wkbType}`);
        }
        return `${geomConstructors[wkbType]}(${result.join(',')})`;
    }
    return `GeomFromText('${parseGeometry()}')`;
}
function intToBit(int) {
    let bits = int.toString(2);
    while (bits.length < 8) {
        bits = `0${bits}`;
    }
    return bits;
}
/**
 * sql-formatter doesn't support hex/binary literals
 * so we wrap them in this fake function call which gets removed later
 */
function noformatWrap(str) {
    return `NOFORMAT_WRAP("##${str}##")`;
}
const DBNULL = 'NULL';
function typeCast(tables) {
    const tablesByName = tables.reduce((acc, t) => {
        acc.set(t.name, t);
        return acc;
    }, new Map());
    // eslint-disable-next-line complexity
    return (field) => {
        const table = tablesByName.get(field.table);
        const columnType = resolveType(table.columns[field.name].type);
        let value = '';
        /* istanbul ignore else */ // the else case shouldn't happen ever
        if (columnType === 'GEOMETRY') {
            // parse and convert the binary representation to a nice string
            const buf = field.buffer();
            if (buf === null) {
                value = null;
            }
            else {
                value = parseGeometryValue(buf);
            }
        }
        else if (columnType === 'STRING') {
            // sanitize the string types
            value = sqlstring.escape(field.string());
        }
        else if (columnType === 'BIT') {
            // bit fields have a binary representation we have to deal with
            const buf = field.buffer();
            if (buf === null) {
                value = null;
            }
            else {
                // represent a binary literal (b'010101')
                const numBytes = buf.length;
                let bitString = '';
                for (let i = 0; i < numBytes; i += 1) {
                    const int8 = buf.readUInt8(i);
                    bitString += intToBit(int8);
                }
                // truncate the bit string to the field length
                bitString = bitString.substr(-field.length);
                value = noformatWrap(`b'${bitString}'`);
            }
        }
        else if (columnType === 'HEX') {
            // binary blobs
            const buf = field.buffer();
            if (buf === null) {
                value = null;
            }
            else {
                // represent a hex literal (X'AF12')
                const numBytes = buf.length;
                let hexString = '';
                for (let i = 0; i < numBytes; i += 1) {
                    const int8 = buf.readUInt8(i);
                    const hex = int8.toString(16);
                    if (hex.length < 2) {
                        hexString += '0';
                    }
                    hexString += hex;
                }
                value = noformatWrap(`X'${hexString}'`);
            }
        }
        else if (columnType === 'NUMBER') {
            value = field.string();
        }
        else {
            throw new Error(`Unknown column type detected: ${columnType}`);
        }
        // handle nulls
        if (value === null) {
            value = DBNULL;
        }
        return value;
    };
}

function buildInsert(table, values, format$$1) {
    const sql = format$$1([
        `INSERT INTO \`${table.name}\` (\`${table.columnsOrdered.join('`,`')}\`)`,
        `VALUES ${values.join(',')};`,
    ].join(' '));
    // sql-formatter lib doesn't support the X'aaff' or b'01010' literals, and it adds a space in and breaks them
    // this undoes the wrapping we did to get around the formatting
    return sql.replace(/NOFORMAT_WRAP\("##(.+?)##"\)/g, '$1');
}
function buildInsertValue(row, table, fakerOptions) {
    const tableOptions = fakerOptions ? fakerOptions.replacements[table.name] : undefined;
    return `(${table.columnsOrdered.map(c => {
        let value = row[c];
        if (tableOptions && tableOptions[c]) {
            const columnOptions = tableOptions[c];
            let algorithm;
            if (typeof columnOptions === 'string') {
                algorithm = columnOptions;
            }
            else {
                const opts = columnOptions;
                algorithm = opts.algorithm;
            }
            if (algorithm.startsWith('replace:')) {
                // allowing a hardcoded value				
                value = algorithm.split(':')[1];
            }
            else if (algorithm.startsWith('email')) {
                // added more random username generator
                //We add the option to avoid certain values
                let exclude = algorithm.split(":")[1];
                exclude = exclude.replace("exclude[", "");
                exclude = exclude.replace("]", "");
                let exclusions = exclude.split(",");
                if (exclusions.indexOf(value) >= 0)
                    return value;
                value =
                    faker.name.lastName() +
                        "." +
                        faker.random.number(9999) + "." +
                        faker.internet.email();
            }
            else if (algorithm.startsWith('username')) {
                // added more random email generator
                //We add the option to avoid certain values
                let exclude = algorithm.split(":")[1];
                exclude = exclude.replace("exclude[", "");
                exclude = exclude.replace("]", "");
                let exclusions = exclude.split(",");
                if (exclusions.indexOf(value) >= 0)
                    return value;
                value = faker.internet.userName() + "_" + faker.random.number(9999);
            }
            else {
                value = faker.fake(`{{${algorithm}}}`)
                    .replace(/'/g, "\\'");
            }
            value = `'${value}'`;
        }
        return value;
    }).join(',')})`;
}
function getDataDump(connectionOptions, options, tables, dumpToFile) {
    return __awaiter(this, void 0, void 0, function* () {
        // setup faker
        if (options.faker && options.faker.locale) {
            const f = faker;
            f['locale'] = options.faker.locale;
        }
        // ensure we have a non-zero max row option
        options.maxRowsPerInsertStatement = Math.max(options.maxRowsPerInsertStatement, 0);
        // clone the array
        tables = [...tables];
        // build the format function if requested
        const format$$1 = options.format
            ? (sql) => sqlformatter.format(sql)
            : (sql) => sql;
        // we open a new connection with a special typecast function for dumping data
        const connection = mysql.createConnection(deepmerge.all([connectionOptions, {
                multipleStatements: true,
                typeCast: typeCast(tables),
            }]));
        const retTables = [];
        let currentTableLines = [];
        // open the write stream (if configured to)
        const outFileStream = dumpToFile ? fs.createWriteStream(dumpToFile, {
            flags: 'a',
            encoding: 'utf8',
        }) : null;
        function saveChunk(str, inArray = true) {
            if (!Array.isArray(str)) {
                str = [str];
            }
            // write to file if configured
            if (outFileStream) {
                str.forEach(s => outFileStream.write(`${s}\n`));
            }
            // write to memory if configured
            if (inArray && currentTableLines) {
                currentTableLines.push(...str);
            }
        }
        // to avoid having to load an entire DB's worth of data at once, we select from each table individually
        // note that we use async/await within this loop to only process one table at a time (to reduce memory footprint)
        while (tables.length > 0) {
            const table = tables.shift();
            if (table.isView && !options.includeViewData) {
                // don't dump data for views
                retTables.push(deepmerge.all([table, {
                        data: null,
                    }]));
                // eslint-disable-next-line no-continue
                continue;
            }
            currentTableLines = options.returnFromFunction ? [] : null;
            if (retTables.length > 0) {
                // add a newline before the next header to pad the dumps
                saveChunk('');
            }
            // write the table header to the file
            const header = [
                '# ------------------------------------------------------------',
                `# DATA DUMP FOR TABLE: ${table.name}`,
                '# ------------------------------------------------------------',
                '',
            ];
            saveChunk(header);
            // eslint-disable-next-line no-await-in-loop
            yield new Promise((resolve, reject) => {
                // send the query
                const where = options.where[table.name] ? ` WHERE ${options.where[table.name]}` : '';
                const query = connection.query(`SELECT * FROM \`${table.name}\`${where}`);
                let rowQueue = [];
                // stream the data to the file
                query.on('result', (row) => {
                    // build the values list
                    rowQueue.push(buildInsertValue(row, table, options.faker));
                    // if we've got a full queue
                    if (rowQueue.length === options.maxRowsPerInsertStatement) {
                        // create and write a fresh statement
                        const insert = buildInsert(table, rowQueue, format$$1);
                        saveChunk(insert);
                        rowQueue = [];
                    }
                });
                query.on('end', () => {
                    // write the remaining rows to disk
                    if (rowQueue.length > 0) {
                        const insert = buildInsert(table, rowQueue, format$$1);
                        saveChunk(insert);
                        rowQueue = [];
                    }
                    resolve();
                });
                query.on('error', /* istanbul ignore next */ /* istanbul ignore next */ err => reject(err));
            });
            // update the table definition
            retTables.push(deepmerge.all([table, {
                    data: currentTableLines ? currentTableLines.join('\n') : null,
                }]));
        }
        saveChunk('');
        // clean up our connections
        yield connection.end();
        if (outFileStream) {
            // tidy up the file stream, making sure writes are 100% flushed before continuing
            yield new Promise((resolve) => {
                outFileStream.once('finish', () => {
                    resolve();
                });
                outFileStream.end();
            });
        }
        return retTables;
    });
}

const pool = [];
class DB {
    // can only instantiate via DB.connect method
    constructor(connection) {
        this.connection = connection;
    }
    static connect(options) {
        return __awaiter(this, void 0, void 0, function* () {
            const instance = new DB(yield mysql$1.createConnection(options));
            pool.push(instance);
            return instance;
        });
    }
    query(sql) {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield this.connection.query(sql);
            return res[0];
        });
    }
    multiQuery(sql) {
        return __awaiter(this, void 0, void 0, function* () {
            let isMulti = true;
            if (sql.split(';').length === 2) {
                isMulti = false;
            }
            let res = (yield this.connection.query(sql))[0];
            if (!isMulti) {
                // mysql will return a non-array payload if there's only one statement in the query
                // so standardise the res..
                res = [res];
            }
            return res;
        });
    }
    end() {
        return this.connection.end().catch(() => { });
    }
    static cleanup() {
        return Promise.all(pool.map(p => p.end()));
    }
}

var Errors = {
    MISSING_CONNECTION_CONFIG: 'Expected to be given `connection` options.',
    MISSING_CONNECTION_HOST: 'Expected to be given `host` connection option.',
    MISSING_CONNECTION_DATABASE: 'Expected to be given `database` connection option.',
    MISSING_CONNECTION_USER: 'Expected to be given `user` connection option.',
    MISSING_CONNECTION_PASSWORD: 'Expected to be given `password` connection option.',
};

// a bunch of session variables we use to make the import work smoothly
const HEADER_VARIABLES = [
    // Add commands to store the client encodings used when importing and set to UTF8 to preserve data
    '/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;',
    '/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;',
    '/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;',
    '/*!40101 SET NAMES utf8 */;',
    // Add commands to disable foreign key checks
    '/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;',
    '/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE=\'NO_AUTO_VALUE_ON_ZERO\' */;',
    '/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;',
    '',
].join('\n');
const FOOTER_VARIABLES = [
    '/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;',
    '/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;',
    '/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;',
    '/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;',
    '/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;',
    '/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;',
    '',
].join('\n');

const defaultOptions = {
    connection: {
        host: 'localhost',
        port: 3306,
        user: '',
        password: '',
        database: '',
        charset: 'UTF8_GENERAL_CI',
        ssl: null,
    },
    dump: {
        tables: [],
        excludeTables: false,
        schema: {
            format: true,
            autoIncrement: true,
            engine: true,
            table: {
                ifNotExist: true,
                dropIfExist: false,
                charset: true,
            },
            view: {
                createOrReplace: true,
                algorithm: false,
                definer: false,
                sqlSecurity: false,
            },
        },
        data: {
            format: true,
            includeViewData: false,
            where: {},
            returnFromFunction: false,
            maxRowsPerInsertStatement: 1,
        },
        trigger: {
            delimiter: ';;',
            dropIfExist: true,
            definer: false,
        },
    },
    dumpToFile: null,
};
function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}
// eslint-disable-next-line complexity
function main(inputOptions) {
    return __awaiter(this, void 0, void 0, function* () {
        let connection;
        try {
            // assert the given options have all the required properties
            assert(inputOptions.connection, Errors.MISSING_CONNECTION_CONFIG);
            assert(inputOptions.connection.host, Errors.MISSING_CONNECTION_HOST);
            assert(inputOptions.connection.database, Errors.MISSING_CONNECTION_DATABASE);
            assert(inputOptions.connection.user, Errors.MISSING_CONNECTION_USER);
            // note that you can have empty string passwords, hence the type assertion
            assert(typeof inputOptions.connection.password === 'string', Errors.MISSING_CONNECTION_PASSWORD);
            const options = deepmerge.all([defaultOptions, inputOptions]);
            // if not dumping to file and not otherwise configured, set returnFromFunction to true.
            if (!options.dumpToFile) {
                const hasValue = inputOptions.dump
                    && inputOptions.dump.data
                    && inputOptions.dump.data.returnFromFunction !== undefined;
                if (options.dump.data && !hasValue) {
                    options.dump.data.returnFromFunction = true;
                }
            }
            // make sure the port is a number
            options.connection.port = parseInt(options.connection.port, 10);
            // write to the destination file (i.e. clear it)
            if (options.dumpToFile) {
                fs.writeFileSync(options.dumpToFile, '');
            }
            // write the initial headers
            if (options.dumpToFile) {
                fs.appendFileSync(options.dumpToFile, `${HEADER_VARIABLES}\n`);
            }
            connection = yield DB.connect(deepmerge.all([options.connection, { multipleStatements: true }]));
            // list the tables
            const res = {
                dump: {
                    schema: null,
                    data: null,
                    trigger: null,
                },
                tables: (yield getTables(connection, options.connection.database, options.dump.tables, options.dump.excludeTables)),
            };
            // dump the schema if requested
            if (options.dump.schema !== false) {
                res.tables = yield getSchemaDump(connection, options.dump.schema, res.tables);
                res.dump.schema = res.tables.map(t => t.schema).filter(t => t).join('\n').trim();
            }
            // write the schema to the file
            if (options.dumpToFile && res.dump.schema) {
                fs.appendFileSync(options.dumpToFile, `${res.dump.schema}\n\n`);
            }
            // dump the triggers if requested
            if (options.dump.trigger !== false) {
                res.tables = yield getTriggerDump(connection, options.connection.database, options.dump.trigger, res.tables);
                res.dump.trigger = res.tables.map(t => t.triggers.join('\n')).filter(t => t).join('\n').trim();
            }
            // data dump uses its own connection so kill ours
            yield connection.end();
            // dump data if requested
            if (options.dump.data !== false) {
                // don't even try to run the data dump
                res.tables = yield getDataDump(options.connection, options.dump.data, res.tables, options.dumpToFile);
                res.dump.data = res.tables.map(t => t.data).filter(t => t).join('\n').trim();
            }
            // write the triggers to the file
            if (options.dumpToFile && res.dump.trigger) {
                fs.appendFileSync(options.dumpToFile, `${res.dump.trigger}\n\n`);
            }
            // reset all of the variables
            if (options.dumpToFile) {
                fs.appendFileSync(options.dumpToFile, FOOTER_VARIABLES);
            }
            return res;
        }
        finally {
            DB.cleanup();
        }
    });
}
// a hacky way to make the package work with both require and ES modules
main.default = main;

module.exports = main;
