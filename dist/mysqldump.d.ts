/// <reference types="node" />

export declare type FakerAlgorithm = "address.zipCode" | "address.city" | "address.cityPrefix" | "address.citySuffix" | "address.streetName" | "address.streetAddress" | "address.streetSuffix" | "address.streetPrefix" | "address.secondaryAddress" | "address.county" | "address.country" | "address.countryCode" | "address.state" | "address.stateAbbr" | "address.latitude" | "address.longitude" | "commerce.color" | "commerce.department" | "commerce.productName" | "commerce.price" | "commerce.productAdjective" | "commerce.productMaterial" | "commerce.product" | "company.suffixes" | "company.companyName" | "company.companySuffix" | "company.catchPhrase" | "company.bs" | "company.catchPhraseAdjective" | "company.catchPhraseDescriptor" | "company.catchPhraseNoun" | "company.bsAdjective" | "company.bsBuzz" | "company.bsNoun" | "database.column" | "database.type" | "database.collation" | "database.engine" | "date.past" | "date.future" | "date.between" | "date.recent" | "date.soon" | "date.month" | "date.weekday" | "finance.account" | "finance.accountName" | "finance.mask" | "finance.amount" | "finance.transactionType" | "finance.currencyCode" | "finance.currencyName" | "finance.currencySymbol" | "finance.bitcoinAddress" | "finance.ethereumAddress" | "finance.iban" | "finance.bic" | "hacker.abbreviation" | "hacker.adjective" | "hacker.noun" | "hacker.verb" | "hacker.ingverb" | "hacker.phrase" | "image.image" | "image.avatar" | "image.imageUrl" | "image.abstract" | "image.animals" | "image.business" | "image.cats" | "image.city" | "image.food" | "image.nightlife" | "image.fashion" | "image.people" | "image.nature" | "image.sports" | "image.technics" | "image.transport" | "image.dataUri" | "internet.avatar" | "internet.email" | "internet.exampleEmail" | "internet.userName" | "internet.protocol" | "internet.url" | "internet.domainName" | "internet.domainSuffix" | "internet.domainWord" | "internet.ip" | "internet.ipv6" | "internet.userAgent" | "internet.color" | "internet.mac" | "internet.password" | "lorem.word" | "lorem.words" | "lorem.sentence" | "lorem.slug" | "lorem.sentences" | "lorem.paragraph" | "lorem.paragraphs" | "lorem.text" | "lorem.lines" | "name.firstName" | "name.lastName" | "name.findName" | "name.jobTitle" | "name.prefix" | "name.suffix" | "name.title" | "name.jobDescriptor" | "name.jobArea" | "name.jobType" | "phone.phoneNumber" | "phone.phoneNumberFormat" | "phone.phoneFormats" | "random.number" | "random.float" | "random.arrayElement" | "random.objectElement" | "random.uuid" | "random.boolean" | "random.word" | "random.words" | "random.image" | "random.locale" | "random.alphaNumeric" | "random.hexaDecimal" | "system.fileName" | "system.commonFileName" | "system.mimeType" | "system.commonFileType" | "system.commonFileExt" | "system.fileType" | "system.fileExt" | "system.directoryPath" | "system.filePath" | "system.semver";
export interface ConnectionOptions {
	/**
	 * The database host to connect to.
	 * Defaults to 'localhost'.
	 */
	host?: string;
	/**
	 * The port on the host to connect to.
	 * Defaults to 3306.
	 */
	port?: number;
	/**
	 * The database to dump.
	 */
	database: string;
	/**
	 * The DB username to use to connect.
	 */
	user: string;
	/**
	 * The password to use to connect.
	 */
	password: string;
	/**
	 * The charset to use for the connection.
	 * Defaults to 'UTF8_GENERAL_CI'.
	 */
	charset?: string;
	/**
	 * SSL configuration options.
	 * Passing 'Amazon RDS' will use Amazon's RDS CA certificate.
	 *
	 * Otherwise you can pass the options which get passed to tls.createSecureContext.
	 * See: https://nodejs.org/api/tls.html#tls_tls_createsecurecontext_options
	 */
	ssl?: 'Amazon RDS' | null | {
		/**
		 * Optionally override the trusted CA certificates. Default is to trust the well-known CAs curated by Mozilla.
		 */
		ca?: string | Buffer;
		/**
		 * Optional cert chains in PEM format.
		 */
		cert?: string | Buffer;
		/**
		 * Optional cipher suite specification, replacing the default.
		 */
		ciphers?: string;
		/**
		 * Optional PEM formatted CRLs (Certificate Revocation Lists).
		 */
		crl?: string | string[];
		/**
		 * Attempt to use the server's cipher suite preferences instead of the client's.
		 */
		honorCipherOrder?: boolean;
		/**
		 * Optional private keys in PEM format.
		 */
		key?: string | Buffer;
		/**
		 * Optional shared passphrase used for a single private key and/or a PFX.
		 */
		passphrase?: string;
		/**
		 * Optional PFX or PKCS12 encoded private key and certificate chain.
		 */
		pfx?: string | Buffer;
		/**
		 * DO NOT USE THIS OPTION UNLESS YOU REALLY KNOW WHAT YOU ARE DOING!!!
		 * Set to false to allow connection to a MySQL server without properly providing the appropraite CA to trust.
		 */
		rejectUnauthorized?: boolean;
	};
}
export interface SchemaDumpOptions {
	/**
	 * True to include autoincrement values in schema, false otherwise.
	 * Defaults to true.
	 */
	autoIncrement?: boolean;
	/**
	 * True to include engine values in schema, false otherwise.
	 * Defaults to true.
	 */
	engine?: boolean;
	/**
	 * True to run a sql formatter over the output, false otherwise.
	 * Defaults to true.
	 */
	format?: boolean;
	/**
	 * Options for table dumps
	 */
	table?: {
		/**
		 * Guard create table calls with an "IF NOT EXIST"
		 * Defaults to true.
		 */
		ifNotExist?: boolean;
		/**
		 * Drop tables before creation (overrides `ifNotExist`).
		 * Defaults to false.
		 */
		dropIfExist?: boolean;
		/**
		 * Include the `DEFAULT CHARSET = x` at the end of the table definition
		 * Set to true to include the value form the DB.
		 * Set to false to exclude it altogether.
		 * Set to a string to explicitly set the charset.
		 * Defaults to true.
		 */
		charset?: boolean | string;
	};
	view?: {
		/**
		 * Uses `CREATE OR REPLACE` to define views.
		 * Defaults to true.
		 */
		createOrReplace?: boolean;
		/**
		 * Include the `DEFINER = {\`user\`@\`host\` | CURRENT_USER}` in the view definition or not
		 * Defaults to false.
		 */
		definer?: boolean;
		/**
		 * Include the `ALGORITHM = {UNDEFINED | MERGE | TEMPTABLE}` in the view definition or not
		 * Defaults to false.
		 */
		algorithm?: boolean;
		/**
		 * Incldue the `SQL SECURITY {DEFINER | INVOKER}` in the view definition or not
		 * Defaults to false.
		 */
		sqlSecurity?: boolean;
	};
}
export interface TriggerDumpOptions {
	/**
	 * The temporary delimiter to use between statements.
	 * Set to false to not use delmiters
	 * Defaults to ';;'.
	 */
	delimiter?: string | false;
	/**
	 * Drop triggers before creation.
	 * Defaults to false.
	 */
	dropIfExist?: boolean;
	/**
	 * Include the `DEFINER = {\`user\`@\`host\` | CURRENT_USER}` in the view definition or not
	 * Defaults to false.
	 */
	definer?: boolean;
}
export interface FakerColumnOptions {
	algorithm: string;
	args: any[];
}
export interface FakerTableOptions {
	[k: string]: FakerAlgorithm | FakerColumnOptions;
}
export interface DataDumpOptions {
	/**
	 * True to run a sql formatter over the output, false otherwise.
	 * Defaults to true.
	 */
	format?: boolean;
	/**
	 * Dump data from views.
	 * Defaults to false.
	 */
	includeViewData?: boolean;
	/**
	 * Maximum number of rows to include in each multi-line insert statement
	 * Defaults to 1 (i.e. new statement per row).
	 */
	maxRowsPerInsertStatement?: number;
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
	returnFromFunction?: boolean;
	/**
	 * A map of tables to additional where strings to add.
	 * Use this to limit the number of data that is dumped.
	 * Defaults to no limits
	 */
	where?: {
		[k: string]: string;
	};
	faker?: {
		[k: string]: FakerTableOptions;
	};
}
export interface DumpOptions {
	/**
	 * The list of tables that you want to dump.
	 * Defaults to all tables (signalled by passing an empty array).
	 */
	tables?: string[];
	/**
	 * True to use the `tables` options as a blacklist, false to use it as a whitelist.
	 * Defaults to false.
	 */
	excludeTables?: boolean;
	/**
	 * Explicitly set to false to not include the schema in the dump.
	 * Defaults to including the schema.
	 */
	schema?: false | SchemaDumpOptions;
	/**
	 * Explicitly set to false to not include data in the dump.
	 * Defaults to including the data.
	 */
	data?: false | DataDumpOptions;
	/**
	 * Explicitly set to false to not include triggers in the dump.
	 * Defaults to including the triggers.
	 */
	trigger?: false | TriggerDumpOptions;
}
export interface Options {
	/**
	 * Database connection options
	 */
	connection: ConnectionOptions;
	/**
	 * Dump configuration options
	 */
	dump?: DumpOptions;
	/**
	 * Set to a path to dump to a file.
	 * Exclude to just return the string.
	 */
	dumpToFile?: string | null;
}
export interface ColumnList {
	/**
	 * Key is the name of the column
	 */
	[k: string]: {
		/**
		 * The type of the column as reported by the underlying DB.
		 */
		type: string;
		/**
		 * True if the column is nullable, false otherwise.
		 */
		nullable: boolean;
	};
}
export interface Table {
	/**
	 * The name of the table.
	 */
	name: string;
	/**
	 * The raw SQL schema dump for the table.
	 * Null if configured to not dump.
	 */
	schema: string | null;
	/**
	 * The raw SQL data dump for the table.
	 * Null if configured to not dump.
	 */
	data: string | null;
	/**
	 * The list of column definitions for the table.
	 */
	columns: ColumnList;
	/**
	 * An ordered list of columns (for consistently outputing as per the DB definition)
	 */
	columnsOrdered: string[];
	/**
	 * True if the table is actually a view, false otherwise.
	 */
	isView: boolean;
	/**
	 * A list of triggers attached to the table
	 */
	triggers: string[];
}
export interface DumpReturn {
	/**
	 * The result of the dump
	 */
	dump: {
		/**
		 * The concatenated SQL schema dump for the entire database.
		 * Null if configured not to dump.
		 */
		schema: string | null;
		/**
		 * The concatenated SQL data dump for the entire database.
		 * Null if configured not to dump.
		 */
		data: string | null;
		/**
		 * The concatenated SQL trigger dump for the entire database.
		 * Null if configured not to dump.
		 */
		trigger: string | null;
	};
	tables: Table[];
}
export default function main(inputOptions: Options): Promise<DumpReturn>;

export as namespace mysqldump;
