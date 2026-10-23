# Dependencies

The web client has no build step and no runtime CDN requirement. SheetJS Community Edition 0.20.3 is vendored locally for XLSX/CSV conversion under Apache 2.0; its license is in web/vendor/XLSX-LICENSE.txt. Spreadsheet input is limited to 2 MB and 5,001 parsed rows. Do not import untrusted or sensitive spreadsheets on shared devices.

Android dependencies are declared in android/app/build.gradle. Gradle requires network access on the first build. Node's built-in HTTP server and fetch implement the optional service without runtime npm dependencies.
