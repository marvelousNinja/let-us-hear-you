for /f "delims=" %%x in (./../config.env) do (set "%%x")

wsk package bind /whisk.system/cloudant letUsHearYouDatabase^
  -p username %CLOUDANT_USERNAME%^
  -p password %CLOUDANT_PASSWORD%^
  -p host %CLOUDANT_HOST%^
  -p dbname let_us_hear_you

wsk trigger create letUsHearYouDatabaseChanged^
  --feed letUsHearYouDatabase/changes^
  --param includeDoc true
