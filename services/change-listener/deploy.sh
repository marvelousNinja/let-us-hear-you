#!/bin/bash

source ./../config.env

wsk package bind /whisk.system/cloudant letUsHearYouDatabase \
  -p username $CLOUDANT_USERNAME \
  -p password $CLOUDANT_PASSWORD \
  -p host $CLOUDANT_HOST \
  -p dbname $CLOUDANT_DB

wsk trigger create letUsHearYouDatabaseChanged \
  --feed letUsHearYouDatabase/changes \
  --param includeDoc true
