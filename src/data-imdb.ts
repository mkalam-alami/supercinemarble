import * as levenshtein from 'fast-levenshtein';
import { downloadGzipped, readDataString, runInDb } from "./data-io";
import { all, finalizeStmt, run, runStmt } from './sqlite-async';

interface ImdbName {
  nconst: string;
  primaryName: string;
  birthYear: string;
  deathYear: string;
  primaryProfession: string;
  knownForTitles: string;
}

interface ImdbMovie {
  tconst: string;
  titleType: string;
  primaryTitle: string;
  originalTitle: string;
  isAdult: string;
  startYear: string;
  endYear: string;
  runtimeMinutes: string;
  genres: string;
}

export async function searchIMDBTitle(title: string): Promise<Array<{ movie: ImdbMovie; distance: number; }>> {
  console.log(`Searching: ${title}`);

  const dbPath = await initializeIMDBTitleBasicsDb();

  return runInDb(dbPath, (db) => {
    return new Promise((resolve, reject) => {
      db.all('select * from title_basics where primaryTitle LIKE ?', '%' + title + '%', (err, rows) => {
        if (err) reject(err);

        const movies = rows
          .map((movie: ImdbMovie) => {
            return { movie, distance: levenshtein.get(movie.primaryTitle, title, { useCollator: true }) };
          })
          .sort((a, b) => a.distance - b.distance);
        resolve(movies);
      })
    })
  })
}

async function initializeIMDBTitleBasicsDb() {
  return initializeIMDBSourceDb({
    sourceName: 'title.basics',
    tableColumns: `tconst TEXT PRIMARY KEY,
      primaryTitle TEXT,
      originalTitle TEXT,
      startYear INTEGER,
      runtimeMinutes TEXT,
      genres TEXT`,
    lineFilter: line => line.includes('\tmovie\t'),
    insertQuery: `INSERT INTO title_basics(
      tconst,
      primaryTitle,
      originalTitle,
      startYear,
      runtimeMinutes,
      genres)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(tconst) DO NOTHING;`,
    // header: "tconst	titleType	primaryTitle	originalTitle	isAdult	startYear	endYear	runtimeMinutes	genres"
    insertParamsProvider: (values) => [values[0], values[2], values[3], values[5], values[7], values[8]],
    indexesQuery: 'CREATE INDEX IF NOT EXISTS primaryTitle ON title_basics (primaryTitle)'
  });

}

let imdbInitializedSources: Record<string, boolean> = {};

async function initializeIMDBSourceDb({
  sourceName,
  tableColumns,
  lineFilter,
  insertQuery,
  insertParamsProvider,
  indexesQuery
}: {
  sourceName: string,
  tableColumns: string,
  lineFilter: (line: string) => boolean,
  insertQuery: string,
  insertParamsProvider: (values: any[]) => any[],
  indexesQuery: string
}) {
  const dbFilePath = `input/imdb.${sourceName}.db`;
  if (!imdbInitializedSources[sourceName]) {
    imdbInitializedSources[sourceName] = true;
  } else {
    return dbFilePath;
  }

  console.log(`INITIALIZING IMDB SOURCE: ${sourceName}`);
  console.log("Reading TSV...");
  const tsv = await readIMDBSourceAsTSV(sourceName);
  const tableName = sourceName.replace(/\./g, '_');

  try {
    await runInDb(dbFilePath, async (db) => {
      await run(db, 'PRAGMA page_size = 10000');
      await run(db, 'PRAGMA synchronous = OFF'); // Can corrupt the DB in case of a hardware crash

      await run(db, `
        CREATE TABLE IF NOT EXISTS ${tableName} (${tableColumns})
    `);

      const existingTitles = await all(db, `SELECT count(*) as c FROM ${tableName}`);
      console.log(`Skipping ${existingTitles[0]['c']} lines already inserted...`);

      const linesToInsert = tsv.split('\n')
        .filter(lineFilter)
        .slice(existingTitles[0]['c']);

      const insertStmt = db.prepare(insertQuery);

      let i = 0;
      await run(db, 'BEGIN TRANSACTION;')
      for (const line of linesToInsert) {
        const values = line.split('\t').map(value => value.replace('\\N', ''));

        if (i++ % 10000 === 0) {
          console.log(`Insert progress: ${i}/${linesToInsert.length} (${Math.floor(100. * i / linesToInsert.length)}%)...`);
        }
        if (i % 1000 === 0) {
          await run(db, 'END TRANSACTION; BEGIN TRANSACTION;')
        }

        await runStmt(insertStmt, insertParamsProvider(values));
      }
      await finalizeStmt(insertStmt);
      await run(db, 'END TRANSACTION;')
      console.log("Inserts complete");

      await run(db, indexesQuery);
      console.log("Indexes created");
    });

    return dbFilePath;
  } catch (e) {
    console.error("ERROR: ", e, e.stack);
  }
}

async function readIMDBSourceAsTSV(sourceFileName: string): Promise<string> {
  let tsv = readDataString(`input/imdb.${sourceFileName}.tsv`);
  if (!tsv) {
    await downloadGzipped(`https://datasets.imdbws.com/${sourceFileName}.tsv.gz`, 'input', `imdb.${sourceFileName}.tsv`);
    tsv = readDataString(`input/imdb.${sourceFileName}.tsv`);
  }
  return tsv;
}
