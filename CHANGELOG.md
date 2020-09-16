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
