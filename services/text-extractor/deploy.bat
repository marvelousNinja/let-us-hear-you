for /f "delims=" %%x in (./../config.env) do (set "%%x")

wsk action update extractText extract-text.js^
  -p cloudant_url https://%CLOUDANT_USERNAME%:%CLOUDANT_PASSWORD%@%CLOUDANT_HOST%^
  -p cloudant_db %CLOUDANT_DB%^
  -p speech_to_text_url %SPEECH_TO_TEXT_URL%^
  -p speech_to_text_username %SPEECH_TO_TEXT_USERNAME%^
  -p speech_to_text_password %SPEECH_TO_TEXT_PASSWORD%

wsk rule create --enable extractTextOnChange letUsHearYouDatabaseChanged extractText
