# Creating a new option
1.  Go to `options_interface.ts` and add the option to `OptionDefinitions`, specifying its intended data type (boolean, string, number). Note that in the end the option will still be stored as a string, but this aids in type safety across the application.
2.  To add a new option with a set default, go to `options_init.ts` in the server and add a new entry in the `defaultOptions`.
3.  **Make the option adjustable by the client**  
    By default options are not adjustable or visible to the client. To do so, modify `routes/api/options.ts` to add the newly added option to `ALLOWED_OPTIONS`.
4.  **Controlling whether or not the option can be changed by the user on a per-client basis**
    By default options are server-wide, affecting all clients and users. To add it to the client-specific options list, modify `apps/client/services/local_options.ts` and add the option to the `OPTIONS_ALLOWED_LOCAL` list, then the option will only affect the users configuring them for themselves and not trigger serversided option changes.