import {FakerAlgorithm} from './Faker';

export interface ConnectionOptions {
    /**
     * The database host to connect to.
     * Defaults to 'localhost'.
     */
    host ?: string
    /**
     * The port on the host to connect to.
     * Defaults to 3306.
     */
    port ?: number
    /**
     * The database to dump.
     */
    database : string
    /**
     * The DB username to use to connect.
     */
    user : string
    /**
     * The password to use to connect.
     */
    password : string
    /**
     * The charset to use for the connection.
     * Defaults to 'UTF8_GENERAL_CI'.
     */
    charset ?: string
    /**
     * SSL configuration options.
     * Passing 'Amazon RDS' will use Amazon's RDS CA certificate.
     *
     * Otherwise you can pass the options which get passed to tls.createSecureContext.
     * See: https://nodejs.org/api/tls.html#tls_tls_createsecurecontext_options
     */
    ssl ?: 'Amazon RDS' | null | {
        /**
         * Optionally override the trusted CA certificates. Default is to trust the well-known CAs curated by Mozilla.
         */
        ca ?: string | Buffer
        /**
         * Optional cert chains in PEM format.
         */
        cert ?: string | Buffer
        /**
         * Optional cipher suite specification, replacing the default.
         */
        ciphers ?: string
        /**
         * Optional PEM formatted CRLs (Certificate Revocation Lists).
         */
        crl ?: string | string[]
        /**
         * Attempt to use the server's cipher suite preferences instead of the client's.
         */
        honorCipherOrder ?: boolean
        /**
         * Optional private keys in PEM format.
         */
        key ?: string | Buffer
        /**
         * Optional shared passphrase used for a single private key and/or a PFX.
         */
        passphrase ?: string
        /**
         * Optional PFX or PKCS12 encoded private key and certificate chain.
         */
        pfx ?: string | Buffer
        /**
         * DO NOT USE THIS OPTION UNLESS YOU REALLY KNOW WHAT YOU ARE DOING!!!
         * Set to false to allow connection to a MySQL server without properly providing the appropraite CA to trust.
         */
        rejectUnauthorized ?: boolean
    }
}

export interface SchemaDumpOptions {
    /**
     * True to include autoincrement values in schema, false otherwise.
     * Defaults to true.
     */
    autoIncrement ?: boolean
    /**
     * True to include engine values in schema, false otherwise.
     * Defaults to true.
     */
    engine ?: boolean
    /**
     * True to run a sql formatter over the output, false otherwise.
     * Defaults to true.
     */
    format ?: boolean
    /**
     * Options for table dumps
     */
    table ?: {
        /**
         * Guard create table calls with an "IF NOT EXIST"
         * Defaults to true.
         */
        ifNotExist ?: boolean
        /**
         * Drop tables before creation (overrides `ifNotExist`).
         * Defaults to false.
         */
        dropIfExist ?: boolean
        /**
         * Include the `DEFAULT CHARSET = x` at the end of the table definition
         * Set to true to include the value form the DB.
         * Set to false to exclude it altogether.
         * Set to a string to explicitly set the charset.
         * Defaults to true.
         */
        charset ?: boolean | string
    }
    view ?: {
        /**
         * Uses `CREATE OR REPLACE` to define views.
         * Defaults to true.
         */
        createOrReplace ?: boolean
        /**
         * Include the `DEFINER = {\`user\`@\`host\` | CURRENT_USER}` in the view definition or not
         * Defaults to false.
         */
        definer ?: boolean
        /**
         * Include the `ALGORITHM = {UNDEFINED | MERGE | TEMPTABLE}` in the view definition or not
         * Defaults to false.
         */
        algorithm ?: boolean
        /**
         * Incldue the `SQL SECURITY {DEFINER | INVOKER}` in the view definition or not
         * Defaults to false.
         */
        sqlSecurity ?: boolean
    }
}

export interface TriggerDumpOptions {
    /**
     * The temporary delimiter to use between statements.
     * Set to false to not use delmiters
     * Defaults to ';;'.
     */
    delimiter ?: string | false
    /**
     * Drop triggers before creation.
     * Defaults to false.
     */
    dropIfExist ?: boolean
    /**
     * Include the `DEFINER = {\`user\`@\`host\` | CURRENT_USER}` in the view definition or not
     * Defaults to false.
     */
    definer ?: boolean
}

export interface FakerColumnOptions {
    algorithm: string
    args: any[];
}

export interface FakerTableOptions {
    [k: string]: FakerAlgorithm | FakerColumnOptions
}

export interface FakerOptions {
    locale?: string,
    replacements: {
        [k: string] : FakerTableOptions
    }
}

export interface DataDumpOptions {
    /**
     * True to run a sql formatter over the output, false otherwise.
     * Defaults to true.
     */
    format ?: boolean
    /**
     * Dump data from views.
     * Defaults to false.
     */
    includeViewData ?: boolean
    /**
     * Maximum number of rows to include in each multi-line insert statement
     * Defaults to 1 (i.e. new statement per row).
     */
    maxRowsPerInsertStatement ?: number
    /**
     * True to return the data in a function, false to not.
     * This is useful in databases with a lot of data.
     *
     * We stream data from the DB to reduce the memory footprint.
     * However note that if you want the result returned from the function,
     * this will result in a larger memory footprint as the string has to be stored in memory.
     *
     * Defaults to false if dumpToFile is truthy, or true if not dumpToFile is falsey.
     */
    returnFromFunction ?: boolean
    /**
     * A map of tables to additional where strings to add.
     * Use this to limit the number of data that is dumped.
     * Defaults to no limits
     */
    where ?: {
        [k : string] : string
    }

    faker ?: FakerOptions
}

export interface DumpOptions {
    /**
     * The list of tables that you want to dump.
     * Defaults to all tables (signalled by passing an empty array).
     */
    tables ?: string[]
    /**
     * True to use the `tables` options as a blacklist, false to use it as a whitelist.
     * Defaults to false.
     */
    excludeTables ?: boolean
    /**
     * Explicitly set to false to not include the schema in the dump.
     * Defaults to including the schema.
     */
    schema ?: false | SchemaDumpOptions
    /**
     * Explicitly set to false to not include data in the dump.
     * Defaults to including the data.
     */
    data ?: false | DataDumpOptions
    /**
     * Explicitly set to false to not include triggers in the dump.
     * Defaults to including the triggers.
     */
    trigger ?: false | TriggerDumpOptions
}

export interface Options {
    /**
     * Database connection options
     */
    connection : ConnectionOptions
    /**
     * Dump configuration options
     */
    dump ?: DumpOptions
    /**
     * Set to a path to dump to a file.
     * Exclude to just return the string.
     */
    dumpToFile ?: string | null
}

// Recursively requires all properties on an object
type RequiredRecursive<T> = {
    // eslint-disable-next-line typescript/type-annotation-spacing
    [P in keyof T] -?: Exclude<T[P], undefined> extends (string | number | boolean | string[] | number[] | boolean[])
        ? T[P]
        : RequiredRecursive<T[P]> // eslint-disable-line no-use-before-define, typescript/no-use-before-define
}

export interface CompletedOptions {
    connection : Required<ConnectionOptions>
    dump : RequiredRecursive<DumpOptions>
    dumpToFile : string | null
}

export default Options
