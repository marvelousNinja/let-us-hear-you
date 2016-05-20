for /f "delims=" %%x in (./../config.env) do (set "%%x")

wsk action update sendSms send-sms.js^
  -p cloudant_url https://%CLOUDANT_USERNAME%:%CLOUDANT_PASSWORD%@%CLOUDANT_HOST%^
  -p cloudant_db %CLOUDANT_DB%^
  -p twilio_url %TWILIO_URL%^
  -p twilio_sid %TWILIO_SID%^
  -p twilio_access_key %TWILIO_ACCESS_KEY%^
  -p twilio_phone_number %TWILIO_PHONE_NUMBER%^
  -p manager_phone_number %MANAGER_PHONE_NUMBER%

wsk rule create --enable sendSmsOnChange letUsHearYouDatabaseChanged sendSms
