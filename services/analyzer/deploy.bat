for /f "delims=" %%x in (./../config.env) do (set "%%x")

wsk action create analyze analyze.js^
  -p cloudant_url https://%CLOUDANT_USERNAME%:%CLOUDANT_PASSWORD%@%CLOUDANT_HOST%^
  -p cloudant_db %CLOUDANT_DB%^
  -p tone_analyzer_url %TONE_ANALYZER_URL%^
  -p tone_analyzer_username %TONE_ANALYZER_USERNAME%^
  -p tone_analyzer_password %TONE_ANALYZER_PASSWORD%

wsk rule create --enable analyzeOnChange letUsHearYouDatabaseChanged analyze
