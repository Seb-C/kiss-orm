# 2.0.0

- Changing the design of the sequence, so that it gives a proper database rather than a single query method.
- Changing the design of the relationships. You can find more about it [here](https://github.com/Seb-C/kiss-orm/pull/22/commits/9d076e2f8edfd0737841d9583f8ec94eb6c2e62f#diff-b335630551682c19a781afebcf4d07bf978fb1f8ac04c6bf87428ed5106870f5)
- Added a simple abstraction layer to better support the databases capabilities when getting data after an insert or update
- Added experimental support for MySQL databases
- Added experimental support for Sqlite databases
- Changed the minimal node version to 12 to avoid problems related to the ES6 modules
- Updated the node dependencies

# 1.1.1

- Fixing some classes requiring the index, creating recursive dependencies
- Fixing the update method removing all properties unrelated to the table

# 1.1.0

- Added a default value (comma) for the `sqlJoin` function

# 1.0.0

- Removing the auto-reconnect option
- Using pg-pool instead of a simple connection
- Added a missing method in `DatabaseInterface`
- Removing the `connect` method from the database class and interface
- Allowing injection of an already-instanciated database rather that a database configuration
- Separating the `indexToPlaceholder` method and unit-testing it
- Adding the `sequence` method for multi-query transactions
- Fixing the migration transaction isolation

# 0.5.1

- Fixing the auto-reconnect option design

# 0.5.0

- Automatically reconnecting the database

# 0.4.0

- Changed the error objects so that it extends the native `Error`.

# 0.2.0

- Adding advanced generic typings for the method arguments
- Exported the exception classes

# 0.1.1

- Fixing incompatible imports syntax when used as a dependency

# 0.1.0

- Made the repository use the abstract interface rather than a specific implementation
- Fixing the publication script to have proper types and plain JS

# 0.0.0

- Initial release
