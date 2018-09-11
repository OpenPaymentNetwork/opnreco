// This file configures ImportJS for automatic JS imports. See:
// https://github.com/Galooshi/import-js
// https://github.com/Galooshi/sublime-import-js

module.exports = {
    excludes: [
        './src/**/*.test.js'
    ],
    environments: ['browser'],
    groupImports: false,
    importStatementFormatter: (options) => {
      // Adjust material-ui imports to avoid accidentally importing the entire
      // material-ui bundle.
      let stmt = options.importStatement;
      const match = (
        /import \{\s*([A-Za-z,\s]+)\s*\} from '@material-ui\/core';/.exec(stmt));
      if (match) {
        const names = match[1].split(',');
        stmt = names.map((nameWithWhitespace) => {
          const name = nameWithWhitespace.trim();
          return `import ${name} from '@material-ui/core/${name}';`;
        }).join('\n');
      }
      return stmt;
    },
}
